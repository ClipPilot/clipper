# Pre-Deployment Checklist

Before you deploy Clipster to AWS, complete these steps:

## ✅ Completed

- [x] Health endpoint added (`/health`)
- [x] LOCAL_VIDEO_PATH removed (not needed)
- [x] Database schema ready (Drizzle + Supabase)
- [x] Terraform infrastructure configured
- [x] GitHub Actions workflows created
- [x] Dockerfile configured with ffmpeg + Puppeteer

## 📋 To Do Before Deployment

### 1. Update CORS Configuration

**File**: `backend/src/app.ts`

**Current**:
```typescript
app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);
```

**Update to**:
```typescript
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
```

Then Terraform will automatically set `FRONTEND_URL` to your Amplify domain.

### 2. Configure GitHub Secrets

Add these in **GitHub Repository Settings → Secrets and variables → Actions → New repository secret**:

```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
OPENAI_API_KEY=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
DEEPGRAM_API_KEY=c8440acfcd6f3c96d671c618ea3ee03129c7ecd1
DATABASE_URL=postgresql://postgres.rnfqnrinhymzmgaqvjhy:TpXCCBTSLuCRXkNY@aws-0-us-west-2.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://rnfqnrinhymzmgaqvjhy.supabase.co
SUPABASE_ANON_KEY=sb_publishable_PNY1yfGaFConxagiXfQUag_y8qN06hD
GH_PAT=ghp_YOUR_GITHUB_PERSONAL_ACCESS_TOKEN
```

**To create GH_PAT**:
1. GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with scopes: `repo`, `admin:repo_hook`
3. Copy and add as secret

### 3. Create Terraform State S3 Bucket

```bash
aws s3 mb s3://clipster-terraform-state --region us-west-2
aws s3api put-bucket-versioning \
  --bucket clipster-terraform-state \
  --versioning-configuration Status=Enabled
```

### 4. Run Database Migrations (First Time Only)

Your Supabase database needs the schema created:

```bash
cd packages/shared-db
DATABASE_URL="postgresql://postgres.rnfqnrinhymzmgaqvjhy:TpXCCBTSLuCRXkNY@aws-0-us-west-2.pooler.supabase.com:6543/postgres" pnpm run db:migrate
```

This creates all tables, enums, and indexes from your Drizzle migrations.

### 5. Verify Supabase Configuration

**Check in Supabase Dashboard**:
- ✅ Database is active
- ✅ Auth is enabled
- ✅ Email confirmations configured (or disabled for testing)
- ✅ RLS policies configured (if needed)

**Your current config**:
- Database: `postgresql://postgres.rnfqnrinhymzmgaqvjhy@...pooler.supabase.com:6543`
- Auth: `https://rnfqnrinhymzmgaqvjhy.supabase.co`
- Anon Key: `sb_publishable_PNY1yfGaFConxagiXfQUag_y8qN06hD`

### 6. (Optional) Configure Custom Domain

If you want a custom domain like `api.clipster.com`:

**Update**: `infra/alb.tf` line 48:
```hcl
domain_name = "api.yourdomain.com"  # Change this
```

If not, the ALB DNS name will work fine (e.g., `clipster-alb-prod-123456.us-west-2.elb.amazonaws.com`)

### 7. Review Infrastructure Costs

Expected monthly costs in `us-west-2`:

| Service | Cost |
|---------|------|
| ECS Fargate (2 tasks) | ~$60 |
| Application Load Balancer | ~$20 |
| NAT Gateways (2x) | ~$65 |
| S3 Storage | ~$2-5 |
| CloudWatch Logs | ~$1 |
| Secrets Manager | ~$2 |
| Amplify | ~$15-30 |
| **Total** | **~$165-185/month** |

## 🚀 Ready to Deploy?

Once all above items are complete:

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

GitHub Actions will automatically:
1. ✅ Deploy infrastructure (Terraform)
2. ✅ Build backend Docker image
3. ✅ Push to ECR
4. ✅ Deploy to ECS Fargate
5. ✅ Deploy frontend to Amplify

## 📊 Monitor Deployment

**GitHub Actions**: Go to Actions tab and watch workflows

**Get URLs after deployment**:
```bash
cd infra
terraform output
```

## ✅ Post-Deployment Verification

### 1. Test Backend Health

```bash
# Get ALB DNS from Terraform outputs
curl https://YOUR_ALB_DNS/health

# Should return:
# {"status":"healthy","timestamp":"2025-12-13T...","service":"clipster-backend"}
```

### 2. Test Frontend

Visit the Amplify URL from Terraform output:
```
https://main.xxxxx.amplifyapp.com
```

### 3. View Logs

```bash
# Backend logs
aws logs tail /ecs/clipster-backend-prod --follow --region us-west-2

# Filter errors only
aws logs tail /ecs/clipster-backend-prod --follow --filter-pattern "ERROR"
```

### 4. Test API Endpoints

```bash
# Test auth signup
curl -X POST https://YOUR_ALB_DNS/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "testpass123",
    "firstName": "Test",
    "lastName": "User"
  }'
```

## 🐛 Troubleshooting

### Backend tasks not starting?

```bash
# Check ECS service
aws ecs describe-services \
  --cluster clipster-cluster-prod \
  --services clipster-backend-prod \
  --region us-west-2

# Check task logs
aws logs tail /ecs/clipster-backend-prod --follow
```

### Amplify build failing?

1. Check build logs in AWS Amplify console
2. Verify `NEXT_PUBLIC_API_URL` is set correctly
3. Check pnpm installation in build spec

### Database connection errors?

1. Verify DATABASE_URL in Secrets Manager
2. Check Supabase project is active
3. Test connection from local machine

## 📚 Additional Resources

- [Deployment Quick Start](./DEPLOYMENT_QUICKSTART.md)
- [Full Deployment Guide](./infra/DEPLOYMENT.md)
- [Infrastructure README](./infra/README.md)
- [GitHub Actions Guide](./.github/workflows/README.md)

## 🔐 Security Reminders

- ✅ Never commit secrets to Git
- ✅ Rotate API keys regularly
- ✅ Use GitHub Environments for production
- ✅ Enable branch protection on `main`
- ✅ Review AWS IAM permissions

## 🎉 You're Ready!

Once you complete the checklist above, your deployment will succeed. The infrastructure is production-ready and will auto-scale based on demand.

Good luck! 🚀
