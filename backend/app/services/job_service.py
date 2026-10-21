jobs = {}


def create_job(job_id: str):
    jobs[job_id] = {
        "job_id": job_id,
        "status": "created",
        "filename": None,
    }

    return jobs[job_id]


def update_job(job_id: str, **updates):
    if job_id not in jobs:
        create_job(job_id)

    jobs[job_id].update(updates)

    return jobs[job_id]


def get_job(job_id: str):
    return jobs.get(job_id)