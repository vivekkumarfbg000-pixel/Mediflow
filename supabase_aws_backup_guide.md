# VitalSync: Automated Supabase to AWS S3 Backup Guide 🛡️
*A Cost-Free, Zero-Maintenance Daily Backup System for Solo Operators*

Since **Supabase Free Tier** does not include automated daily backups (which cost $25/month on the Pro tier), you can build your own enterprise-grade daily backup pipeline using **AWS S3 Free Tier** (5GB free storage) and **GitHub Actions** (2,000 free runner minutes/month) for **₹0/month**.

Here is the step-by-step setup guide.

---

## 🏗️ How it Works
Every night at 00:00 UTC, a GitHub Action runner spins up, connects to your Supabase PostgreSQL database using `pg_dump`, creates a compressed SQL backup, and uploads it securely to your AWS S3 bucket.

```
┌──────────────┐           ┌────────────────┐           ┌──────────────┐
│   Supabase   │  pg_dump  │ GitHub Actions │  aws s3 cp │    AWS S3    │
│  (Database)  ├──────────►│  (Free Runner) ├───────────►│ (Free Bucket)│
└──────────────┘           └────────────────┘           └──────────────┘
```

---

## 📝 Step-by-Step Setup

### Step 1: Set up AWS S3 (Free Tier)
1. Log in to your [AWS Management Console](https://aws.amazon.com/).
2. Search for **S3** and click **Create bucket**.
3. Configure the bucket:
   * **Bucket name**: `vitalsync-database-backups` (choose a unique name).
   * **Region**: Select a region close to your database (e.g., `ap-south-1` for Mumbai).
   * **Block public access**: Ensure **Block all public access** is checked (keep your data private!).
   * Click **Create bucket**.

### Step 2: Set a 30-Day Auto-Cleanup Rule (To stay inside 5GB limit)
To ensure you never exceed the 5GB AWS free tier storage limit:
1. Open your newly created S3 bucket.
2. Go to the **Management** tab and click **Create lifecycle rule**.
3. Configure the rule:
   * **Rule name**: `DeleteOldBackups`
   * **Rule scope**: Select **Apply to all objects in the bucket**.
   * **Lifecycle rule actions**: Check **Expire current versions of objects**.
   * **Days after object creation**: Enter `30` (this keeps a rolling 30 days of backups and automatically deletes older ones).
   * Click **Create rule**.

### Step 3: Create an IAM User for GitHub Access
1. Search for **IAM** in the AWS console.
2. Go to **Users** $\rightarrow$ **Create user**.
3. Name the user `github-backup-agent` and click **Next**.
4. In permissions, choose **Attach policies directly** and click **Create policy**.
5. Switch to the **JSON** tab and paste this policy (replace `vitalsync-database-backups` with your actual bucket name):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::vitalsync-database-backups",
           "arn:aws:s3:::vitalsync-database-backups/*"
         ]
       }
     ]
   }
   ```
6. Complete creating the policy, return to the user creation page, attach this newly created policy to `github-backup-agent`, and click **Create user**.
7. Click on the created user, go to the **Security credentials** tab, scroll to **Access keys**, and click **Create access key**.
8. Select **Command Line Interface (CLI)**, download the `.csv` containing your `Access Key ID` and `Secret Access Key`.

---

### Step 4: Add Secrets to GitHub
Go to your VitalSync GitHub repository, navigate to **Settings** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions**, and add the following repository secrets:

| Secret Name | Description / Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | The Access Key ID of your IAM user |
| `AWS_SECRET_ACCESS_KEY` | The Secret Access Key of your IAM user |
| `AWS_S3_BUCKET` | Your S3 bucket name (e.g. `vitalsync-database-backups`) |
| `AWS_REGION` | Your bucket's region (e.g., `ap-south-1`) |
| `SUPABASE_DB_URL` | Your Supabase Postgres connection string (Get it from Supabase Dashboard $\rightarrow$ Settings $\rightarrow$ Database $\rightarrow$ Connection String $\rightarrow$ URI. Replace the password placeholder with your actual database password). |

*Example Supabase connection string format:*
`postgresql://postgres:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`

---

### Step 5: Add the GitHub Action Workflow File
Create a new file in your project path: [daily_backup.yml](file:///c:/Users/vivek/OneDrive/Desktop/Mediflow%20ecosystem/.github/workflows/daily_backup.yml) with the following content:

```yaml
name: Supabase Daily Database Backup

on:
  schedule:
    # Runs daily at 00:00 UTC (05:30 AM IST)
    - cron: '0 0 * * *'
  workflow_dispatch: # Allows manual trigger from GitHub UI

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Install PostgreSQL Client
        run: |
          sudo apt-get update
          sudo apt-get install -y postgresql-client

      - name: Take PostgreSQL Dump
        run: |
          pg_dump "${{ secrets.SUPABASE_DB_URL }}" -F c -b -v -f backup.sql
          gzip -f backup.sql

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - name: Upload Backup to S3
        run: |
          TIMESTAMP=$(date +%Y-%m-%d_%H-%M-%S)
          aws s3 cp backup.sql.gz s3://${{ secrets.AWS_S3_BUCKET }}/backups/supabase_backup_$TIMESTAMP.sql.gz
