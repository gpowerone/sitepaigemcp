import { Job, JobResultSummary, JobStatus, ResourceDescriptor } from "./types.js";
import { nowIso } from "./utils.js";
import { randomUUID } from "node:crypto";

export class JobRegistry {
  private readonly jobIdToJob: Map<string, Job> = new Map();

  public createJob(expectedDurationSeconds?: number, recommendedPollingIntervalSeconds?: number): Job {
    const id = randomUUID();
    const status: JobStatus = {
      jobId: id,
      status: "queued",
      step: "queued",
      progressPercent: 0,
      startedAt: nowIso(),
      updatedAt: nowIso(),
      expectedDurationSeconds,
      recommendedPollingIntervalSeconds
    };
    const job: Job = { id, status, logs: [] };
    this.jobIdToJob.set(id, job);
    return job;
  }

  public getJob(jobId: string): Job | undefined {
    return this.jobIdToJob.get(jobId);
  }

  public listResourceDescriptors(): ResourceDescriptor[] {
    const descriptors: ResourceDescriptor[] = [];
    for (const job of this.jobIdToJob.values()) {
      const base = `mem://jobs/${job.id}`;
      descriptors.push({ uri: `${base}/status`, name: `Job ${job.id} status`, mimeType: "application/json" });
      descriptors.push({ uri: `${base}/logs`, name: `Job ${job.id} logs`, mimeType: "text/plain" });
      descriptors.push({ uri: `${base}/plan`, name: `Job ${job.id} plan`, mimeType: "text/markdown" });
      descriptors.push({ uri: `${base}/result`, name: `Job ${job.id} result`, mimeType: "application/json" });
    }
    return descriptors;
  }

  public readResource(uri: string): { mimeType: string; body: string } | undefined {
    const parsed = this.parseJobUri(uri);
    if (!parsed) return undefined;
    const { jobId, resource } = parsed;
    const job = this.jobIdToJob.get(jobId);
    if (!job) return undefined;
    if (resource === "status") {
      return { mimeType: "application/json", body: JSON.stringify(job.status, null, 2) };
    }
    if (resource === "logs") {
      return { mimeType: "text/plain", body: job.logs.join("\n") + (job.logs.length ? "\n" : "") };
    }
    if (resource === "plan") {
      return { mimeType: "text/markdown", body: job.plan ?? "" };
    }
    if (resource === "result") {
      return { mimeType: "application/json", body: JSON.stringify(job.result ?? {}, null, 2) };
    }
    return undefined;
  }

  public appendLog(jobId: string, line: string): void {
    const job = this.jobIdToJob.get(jobId);
    if (!job) return;
    job.logs.push(line);
    job.status.updatedAt = nowIso();
  }

  public setPlan(jobId: string, plan: string): void {
    const job = this.jobIdToJob.get(jobId);
    if (!job) return;
    job.plan = plan;
    job.status.updatedAt = nowIso();
  }

  public setStatus(jobId: string, update: Partial<JobStatus>): void {
    const job = this.jobIdToJob.get(jobId);
    if (!job) return;
    job.status = { ...job.status, ...update, jobId: jobId, updatedAt: nowIso() };
  }

  public setResult(jobId: string, result: JobResultSummary): void {
    const job = this.jobIdToJob.get(jobId);
    if (!job) return;
    job.result = result;
    job.status.updatedAt = nowIso();
  }

  public setProjectId(jobId: string, projectId: string): void {
    const job = this.jobIdToJob.get(jobId);
    if (!job) return;
    job.projectId = projectId;
  }

  public setTargetDir(jobId: string, targetDir: string): void {
    const job = this.jobIdToJob.get(jobId);
    if (!job) return;
    job.targetDir = targetDir;
  }

  public setDatabaseType(jobId: string, databaseType: "sqlite" | "postgres" | "mysql"): void {
    const job = this.jobIdToJob.get(jobId);
    if (!job) return;
    job.databaseType = databaseType;
  }

  public parseJobUri(uri: string): { jobId: string; resource: "status" | "logs" | "plan" | "result" } | undefined {
    if (!uri.startsWith("mem://jobs/")) return undefined;
    const tail = uri.substring("mem://jobs/".length);
    const parts = tail.split("/");
    if (parts.length !== 2) return undefined;
    const [jobId, resource] = parts as [string, string];
    if (resource !== "status" && resource !== "logs" && resource !== "plan" && resource !== "result") return undefined;
    return { jobId, resource: resource as any };
  }
}

