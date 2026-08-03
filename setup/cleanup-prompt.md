# WorkshopHub Training Cleanup Prompt

> Save this file to your Claude Code project or paste it as a slash command to automate cleanup after the training.

---

## What this does

1. Optionally removes your local clone of your WorkshopHub fork.
2. Optionally cleans up local Docker resources if you used them.

No self-hosted runner was required for this training — there is nothing to unregister from GitLab/GitHub.
Your fork on GitLab stays until you delete it yourself (optional).

---

## Step 1 (Optional): Remove your local clone

Only do this if you no longer want a local copy of the code you worked on during the training.

```bash
# List what you're about to delete — check the path first
ls ~/workshophub*

# Remove the local clone (adjust the path to match where you cloned)
rm -rf ~/workshophub
```

If you want to keep the code, skip this step. Your fork remains on GitLab until you delete it.

---

## Step 2 (Optional): Delete your GitLab fork

Only if you want to remove the remote project as well:

1. Open your fork on GitLab.
2. **Settings → General → Advanced → Delete project**.
3. Confirm the project path.

Skip this if you want to keep developing after the training.

---

## Step 3: Clean up Docker resources (optional)

If you used `make prod-up` or other Docker commands during the training:

```bash
# Stop and remove training containers
docker ps -a | grep workshophub | awk '{print $1}' | xargs -r docker rm -f

# Remove workshophub images
docker images | grep workshophub | awk '{print $3}' | xargs -r docker rmi -f

# Remove training volumes
docker volume ls | grep workshophub | awk '{print $2}' | xargs -r docker volume rm
```

---

## Verification

After cleanup:
- [ ] Local clone is removed (if you chose to delete it).
- [ ] GitLab fork is deleted (if you chose to delete it).
- [ ] Local Docker containers/images/volumes for WorkshopHub are cleaned up (if applicable).

---

## Keeping your work

If you want to retain your work after the training:
- Keep your GitLab fork (and local clone).
- Your git history preserves the merge requests and commits you made on the fork.
