import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { publicUserSelect } from '../../prisma/selects';
import { JobStatus, ResumeStatus, UserRole } from '../../constants/enums';

const transitions: Record<JobStatus, JobStatus[]> = {
  [JobStatus.DRAFT]: [JobStatus.OPEN],
  [JobStatus.OPEN]: [JobStatus.PAUSED, JobStatus.CLOSED],
  [JobStatus.PAUSED]: [JobStatus.CLOSED, JobStatus.OPEN],
  [JobStatus.CLOSED]: [JobStatus.OPEN, JobStatus.ARCHIVED],
  [JobStatus.ARCHIVED]: [],
};
@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}
  async findAll(query: any, user: any) {
    const where: any = { status: query.status, department: query.department };
    if (user.role === UserRole.HIRING_MANAGER) where.department = user.department;
    return this.prisma.job.findMany({ where, include: { hiringManager: { select: publicUserSelect }, _count: { select: { resumes: true, offers: true } } }, orderBy: { updatedAt: 'desc' } });
  }
  findOne(id: number) { return this.prisma.job.findUnique({ where: { id }, include: { hiringManager: { select: publicUserSelect }, resumes: { include: { candidate: true, interviews: true } }, offers: true } }); }
  create(data: any) { return this.prisma.job.create({ data: { ...data, status: data.status || JobStatus.DRAFT } }); }
  update(id: number, data: any) { return this.prisma.job.update({ where: { id }, data }); }
  async updateStatus(id: number, status: JobStatus, reason?: string) {
    const job = await this.prisma.job.findUnique({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');
    if (!transitions[job.status as JobStatus].includes(status)) throw new BadRequestException(`Invalid Job status transition: ${job.status} -> ${status}`);
    const updated = await this.prisma.job.update({ where: { id }, data: { status } });
    return { ...updated, beforeStatus: job.status, reason };
  }
  resumes(id: number) { return this.prisma.resume.findMany({ where: { jobId: id }, include: { candidate: true, interviews: true } }); }
  interviews(id: number) { return this.prisma.interview.findMany({ where: { resume: { jobId: id } }, include: { resume: { include: { candidate: true } }, interviewer: { select: publicUserSelect } } }); }

  async funnel(jobId?: number) {
    const where: any = {};
    if (jobId) where.jobId = jobId;
    const resumes = await this.prisma.resume.findMany({
      where,
      select: { id: true, status: true, jobId: true, job: { select: { id: true, title: true } } },
    });
    const jobMap = new Map<number, { title: string; submitted: number; screened: number; interviewed: number; offered: number; hired: number }>();
    for (const r of resumes) {
      if (!jobMap.has(r.jobId)) jobMap.set(r.jobId, { title: r.job.title, submitted: 0, screened: 0, interviewed: 0, offered: 0, hired: 0 });
      const f = jobMap.get(r.jobId)!;
      f.submitted++;
      const s = r.status as ResumeStatus;
      if ([ResumeStatus.SHORTLISTED, ResumeStatus.INTERVIEWING, ResumeStatus.OFFERED, ResumeStatus.HIRED].includes(s)) f.screened++;
      if ([ResumeStatus.INTERVIEWING, ResumeStatus.OFFERED, ResumeStatus.HIRED].includes(s)) f.interviewed++;
      if ([ResumeStatus.OFFERED, ResumeStatus.HIRED].includes(s)) f.offered++;
      if (s === ResumeStatus.HIRED) f.hired++;
    }
    const result: any[] = [];
    for (const [id, d] of jobMap) {
      result.push({
        jobId: id,
        title: d.title,
        stages: [
          { name: '投递', count: d.submitted },
          { name: '初筛通过', count: d.screened },
          { name: '面试', count: d.interviewed },
          { name: '录用', count: d.offered },
          { name: '入职', count: d.hired },
        ],
        rates: {
          submittedToScreened: d.submitted ? +(d.screened / d.submitted * 100).toFixed(1) : 0,
          screenedToInterviewed: d.screened ? +(d.interviewed / d.screened * 100).toFixed(1) : 0,
          interviewedToOffered: d.interviewed ? +(d.offered / d.interviewed * 100).toFixed(1) : 0,
          offeredToHired: d.offered ? +(d.hired / d.offered * 100).toFixed(1) : 0,
        },
      });
    }
    return result;
  }
}
