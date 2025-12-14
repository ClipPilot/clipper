# Clipster Deployment Quick Start

Get your Clipster application deployed to AWS in minutes using GitHub Actions.

## 🎯 Overview

- **Frontend**: AWS Amplify (auto-deploys from GitHub)
- **Backend**: AWS ECS Fargate with Docker
- **Database**: Supabase (already configured)
- **Infrastructure**: Terraform + GitHub Actions

## ⚡ Quick Setup (5 minutes)

### Step 1: AWS Setup

1. **Create an AWS account** (if you don't have one)

2. **Create IAM user for deployments:**
   ```bash
   # In AWS Console: IAM → Users → Add users
   # User name: clipster-deployer
   # Access type: Programmatic access
   # Permissions: AdministratorAccess (or create custom policy)
   ```

3. **Save the credentials:**
   - Access Key ID
   - Secret Access Key

4. **Create S3 bucket for Terraform state:**
   ```bash
   aws s3 mb s3://clipster-terraform-state --region us-west-2
   aws s3api put-bucket-versioning \
     --bucket clipster-terraform-state \
     --versioning-configuration Status=Enabled
   ```

### Step 2: GitHub Secrets

Add these secrets in your GitHub repository:

**Settings → Secrets and variables → Actions → New repository secret**

```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
OPENAI_API_KEY=sk-proj-...
DEEPGRAM_API_KEY=...
DATABASE_URL=postgresql://postgres.rnfqnrinhymzmgaqvjhy:TpXCCBTSLuCRXkNY@aws-0-us-west-2.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://rnfqnrinhymzmgaqvjhy.supabase.co
SUPABASE_ANON_KEY=sb_publishable_PNY1yfGaFConxagiXfQUag_y8qN06hD
GH_PAT=ghp_... (GitHub Personal Access Token)
```

**To create GH_PAT:**
1. GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token
3. Select scopes: `repo`, `admin:repo_hook`
4. Copy token and add to secrets

### Step 3: Deploy!

1. **Push to main branch:**
   ```bash
   git add .
   git commit -m "Initial deployment"
   git push origin main
   ```

2. **GitHub Actions will automatically:**
   - Deploy infrastructure (Terraform)
   - Build and push backend Docker image
   - Deploy backend to ECS
   - Deploy frontend to Amplify

3. **Monitor deployment:**
   - Go to GitHub → Actions tab
   - Watch workflows run

4. **Get your URLs:**
   - After deployment completes, check workflow outputs for:
     - Frontend URL: `https://main.xxxxx.amplifyapp.com`
     - Backend URL: `https://xxxxx.us-west-2.elb.amazonaws.com`

## 🎉 That's it!

Your application is now live on AWS!

## 📋 Post-Deployment

### Access Your Application

1. **Frontend**: Click the Amplify URL from workflow output
2. **Backend API**: Use the ALB URL from workflow output

### View Logs

```bash
# Backend logs
aws logs tail /ecs/clipster-backend-prod --follow --region us-west-2
```

### Monitor in AWS Console

- **ECS**: https://console.aws.amazon.com/ecs
- **Amplify**: https://console.aws.amazon.com/amplify
- **S3**: https://console.aws.amazon.com/s3

## 🔄 Updates

### Deploy Backend Changes

```bash
# Make changes to backend/
git add backend/
git commit -m "Update backend"
git push origin main
# GitHub Actions automatically rebuilds and deploys
```

### Deploy Frontend Changes

```bash
# Make changes to frontend/
git add frontend/
git commit -m "Update frontend"
git push origin main
# Amplify automatically rebuilds and deploys
```

### Update Infrastructure

```bash
# Make changes to infra/
git add infra/
git commit -m "Update infrastructure"
git push origin main
# GitHub Actions automatically applies Terraform changes
```

## 🛠️ Troubleshooting

### Workflows failing?

1. **Check GitHub Actions logs:**
   - Go to Actions tab
   - Click on failed workflow
   - Review error messages

2. **Common issues:**
   - **Missing secrets**: Verify all secrets are added
   - **AWS permissions**: Ensure IAM user has AdministratorAccess
   - **Terraform state**: Ensure S3 bucket exists
   - **ECR**: First deployment may take longer (downloading Chrome for Puppeteer)

### Backend not accessible?

```bash
# Check ECS task status
aws ecs describe-services \
  --cluster clipster-cluster-prod \
  --services clipster-backend-prod \
  --region us-west-2

# Check logs
aws logs tail /ecs/clipster-backend-prod --follow --region us-west-2
```

### Frontend not accessible?

- Check Amplify console for build logs
- Verify environment variables in Amplify settings

## 💰 Costs

Expected AWS costs:
- **Development**: ~$50-80/month
- **Production**: ~$165-180/month

**Cost optimization:**
- Delete test environments when not in use
- Use auto-scaling to match demand
- Set up billing alerts

## 🔒 Security Checklist

- ✅ Secrets stored in GitHub Secrets (never in code)
- ✅ HTTPS enforced everywhere
- ✅ Backend in private subnets
- ✅ IAM roles with least privilege
- ✅ S3 buckets encrypted
- ✅ Regular dependency updates via Dependabot

## 📚 Documentation

- **Detailed Deployment Guide**: [infra/DEPLOYMENT.md](infra/DEPLOYMENT.md)
- **Infrastructure README**: [infra/README.md](infra/README.md)
- **GitHub Actions Workflows**: [.github/workflows/README.md](.github/workflows/README.md)

## 🆘 Need Help?

1. Check CloudWatch logs
2. Review GitHub Actions logs
3. Verify all secrets are configured
4. Check AWS service quotas
5. Review Terraform state

## 🎓 What's Deployed?

```
┌─────────────────┐
│   GitHub Repo   │
└────────┬────────┘
         │
    ┌────▼────────────────────────────┐
    │     GitHub Actions (CI/CD)      │
    └────┬─────────────┬──────────────┘
         │             │
    ┌────▼────┐   ┌────▼────────┐
    │Terraform│   │   Docker    │
    │ (Infra) │   │   (Build)   │
    └────┬────┘   └────┬────────┘
         │             │
    ┌────▼─────────────▼─────────────┐
    │          AWS Cloud             │
    │                                │
    │  ┌──────────┐   ┌───────────┐ │
    │  │ Amplify  │   │    ECS    │ │
    │  │(Frontend)│   │ (Backend) │ │
    │  └──────────┘   └───────────┘ │
    │                                │
    │  ┌──────────┐   ┌───────────┐ │
    │  │    S3    │   │Secrets Mgr│ │
    │  │ (Videos) │   │(API Keys) │ │
    │  └──────────┘   └───────────┘ │
    └────────────────────────────────┘
              │
         ┌────▼────────┐
         │  Supabase   │
         │ (Database)  │
         └─────────────┘
```

## 🚀 Ready to Deploy?

1. ✅ AWS account created
2. ✅ IAM user configured
3. ✅ S3 bucket for Terraform state created
4. ✅ GitHub secrets added
5. ✅ Code pushed to main branch

If all checked, your deployment is already running! Check the Actions tab in GitHub.
