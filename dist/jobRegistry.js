import { nowIso } from "./utils.js";
import { randomUUID } from "node:crypto";
export class JobRegistry {
    jobIdToJob = new Map();
    createJob(expectedDurationSeconds, recommendedPollingIntervalSeconds) {
        const id = randomUUID();
        const status = {
            jobId: id,
            status: "queued",
            step: "queued",
            progressPercent: 0,
            startedAt: nowIso(),
            updatedAt: nowIso(),
            expectedDurationSeconds,
            recommendedPollingIntervalSeconds
        };
        const job = { id, status, logs: [] };
        this.jobIdToJob.set(id, job);
        return job;
    }
    getJob(jobId) {
        return this.jobIdToJob.get(jobId);
    }
    listResourceDescriptors() {
        const descriptors = [];
        for (const job of this.jobIdToJob.values()) {
            const base = `mem://jobs/${job.id}`;
            descriptors.push({ uri: `${base}/status`, name: `Job ${job.id} status`, mimeType: "application/json" });
            descriptors.push({ uri: `${base}/logs`, name: `Job ${job.id} logs`, mimeType: "text/plain" });
            descriptors.push({ uri: `${base}/plan`, name: `Job ${job.id} plan`, mimeType: "text/markdown" });
            descriptors.push({ uri: `${base}/result`, name: `Job ${job.id} result`, mimeType: "application/json" });
        }
        return descriptors;
    }
    readResource(uri) {
        const parsed = this.parseJobUri(uri);
        if (!parsed)
            return undefined;
        const { jobId, resource } = parsed;
        const job = this.jobIdToJob.get(jobId);
        if (!job)
            return undefined;
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
    appendLog(jobId, line) {
        const job = this.jobIdToJob.get(jobId);
        if (!job)
            return;
        job.logs.push(line);
        job.status.updatedAt = nowIso();
    }
    setPlan(jobId, plan) {
        const job = this.jobIdToJob.get(jobId);
        if (!job)
            return;
        job.plan = plan;
        job.status.updatedAt = nowIso();
    }
    setStatus(jobId, update) {
        const job = this.jobIdToJob.get(jobId);
        if (!job)
            return;
        job.status = { ...job.status, ...update, jobId: jobId, updatedAt: nowIso() };
    }
    setResult(jobId, result) {
        const job = this.jobIdToJob.get(jobId);
        if (!job)
            return;
        job.result = result;
        job.status.updatedAt = nowIso();
    }
    setProjectId(jobId, projectId) {
        const job = this.jobIdToJob.get(jobId);
        if (!job)
            return;
        job.projectId = projectId;
    }
    setTargetDir(jobId, targetDir) {
        const job = this.jobIdToJob.get(jobId);
        if (!job)
            return;
        job.targetDir = targetDir;
    }
    setDatabaseType(jobId, databaseType) {
        const job = this.jobIdToJob.get(jobId);
        if (!job)
            return;
        job.databaseType = databaseType;
    }
    parseJobUri(uri) {
        if (!uri.startsWith("mem://jobs/"))
            return undefined;
        const tail = uri.substring("mem://jobs/".length);
        const parts = tail.split("/");
        if (parts.length !== 2)
            return undefined;
        const [jobId, resource] = parts;
        if (resource !== "status" && resource !== "logs" && resource !== "plan" && resource !== "result")
            return undefined;
        return { jobId, resource: resource };
    }
}
//# sourceMappingURL=jobRegistry.js.map