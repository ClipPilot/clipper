# AWS Amplify Setup Guide

AWS Amplify is currently disabled in the Terraform configuration. Follow these steps to enable it once your backend infrastructure is deployed and working.

## Why is Amplify Disabled?

The Amplify deployment failed with a GitHub 404 error because either:
1. The GitHub Personal Access Token (PAT) is invalid or missing
2. The token doesn't have the required permissions
3. The repository path is incorrect

## Prerequisites

- ✅ Backend infrastructure deployed successfully (ECS, ALB, S3, etc.)
- ✅ Backend API working and accessible via ALB DNS
- ✅ GitHub repository exists and is accessible

## Step 1: Create GitHub Personal Access Token

1. Go to GitHub Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
   - Or visit: https://github.com/settings/tokens

2. Click "Generate new token" → "Generate new token (classic)"

3. Give it a descriptive name: `AWS Amplify - Clipster Production`

4. Set expiration: Choose "No expiration" or a long duration (90 days)

5. Select the following scopes:
   - ✅ `repo` (Full control of private repositories)
     - repo:status
     - repo_deployment
     - public_repo
     - repo:invite
     - security_events
   - ✅ `admin:repo_hook` (Full control of repository hooks)
     - write:repo_hook
     - read:repo_hook

6. Click "Generate token"

7. **IMPORTANT**: Copy the token immediately - you won't see it again!

## Step 2: Add Token to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Add the secret:
   - Name: `GH_PAT`
   - Value: (paste your Personal Access Token from Step 1)
5. Click "Add secret"

## Step 3: Verify Repository Path

Check your `infra/terraform.tfvars` file and confirm:

```hcl
github_repository = "yourusername/yourreponame"  # e.g., "john/clipster"
```

Make sure this matches your actual GitHub repository path.

## Step 4: Enable Amplify in Terraform

### 1. Edit `infra/amplify.tf`

Uncomment all the Amplify resources:

```hcl
resource "aws_amplify_app" "frontend" {
  # ... (uncomment the entire resource block)
}

resource "aws_amplify_branch" "main" {
  # ... (uncomment the entire resource block)
}
```

### 2. Edit `infra/iam.tf`

Uncomment the Amplify IAM role:

```hcl
resource "aws_iam_role" "amplify" {
  # ... (uncomment the entire resource block)
}

resource "aws_iam_role_policy_attachment" "amplify_backend_deployment" {
  # ... (uncomment the entire resource block)
}
```

### 3. Edit `infra/outputs.tf`

Uncomment the Amplify outputs:

```hcl
output "amplify_app_id" {
  # ... (uncomment)
}

output "amplify_default_domain" {
  # ... (uncomment)
}

output "amplify_app_url" {
  # ... (uncomment)
}
```

## Step 5: Deploy Amplify

### Option A: Via Terraform Locally

```bash
cd infra
terraform plan
terraform apply
```

### Option B: Via GitHub Actions

```bash
git add infra/
git commit -m "Enable AWS Amplify for frontend deployment"
git push origin main
```

The "Terraform - Deploy Infrastructure" workflow will run automatically.

## Step 6: Verify Deployment

After Terraform completes successfully:

1. Check the Terraform outputs:
   ```bash
   terraform output amplify_app_url
   ```

2. Visit the Amplify console:
   - https://console.aws.amazon.com/amplify/
   - Select your app
   - Click on the `main` branch
   - Wait for the build to complete (usually 5-10 minutes)

3. Access your frontend:
   - The URL will be like: `https://main.xxxxx.amplifyapp.com`

## Troubleshooting

### Still getting "GitHub 404 - Not Found"

**Check token permissions:**
- Make sure the PAT has both `repo` and `admin:repo_hook` scopes
- Try creating a new token with fresh permissions

**Check repository path:**
- Verify the repository exists: `https://github.com/yourusername/yourreponame`
- Confirm it's accessible (private repos need the `repo` scope)
- Make sure `terraform.tfvars` has the correct path

**Check token in GitHub Secrets:**
- Go to repository Settings → Secrets → Actions
- Confirm `GH_PAT` secret exists
- If not sure, delete and recreate it

### Build failing in Amplify

**Check build logs** in the Amplify console:

Common issues:
1. **Missing environment variables**: Make sure `NEXT_PUBLIC_API_URL` is set correctly
2. **pnpm not found**: The build spec installs pnpm, check if it's executing
3. **Build errors**: Check if your Next.js app builds locally first

**Fix build issues:**
```bash
cd frontend
pnpm install
pnpm run build
```

### Frontend can't connect to backend

**Check the API URL** in Amplify environment variables:
- It should be: `http://your-alb-dns.us-west-2.elb.amazonaws.com/api`
- Get the ALB DNS: `terraform output alb_dns_name`

**Check CORS** in backend:
- Update `backend/src/app.ts` to allow your Amplify domain
- Add your Amplify URL to allowed origins

## Next Steps

Once Amplify is working:

1. ✅ Test frontend functionality
2. ✅ Update CORS configuration in backend to use Amplify domain
3. ✅ Update Supabase redirect URLs to use Amplify domain
4. ✅ Consider adding custom domain (see `ADDING_CUSTOM_DOMAIN.md`)
5. ✅ Set up monitoring and alerts

## Cost

AWS Amplify pricing:
- **Build minutes**: First 1,000 build minutes/month are free
- **Hosting**: First 15GB served/month is free
- **Storage**: First 5GB stored/month is free

For low to moderate traffic, you'll likely stay within free tier limits.

## Security Best Practices

1. **Rotate your GitHub PAT regularly** (every 90 days)
2. **Use GitHub Secrets** - never commit tokens to the repository
3. **Limit token scope** - only use required permissions
4. **Revoke old tokens** when no longer needed

## Alternative: Deploy Frontend Elsewhere

If you don't want to use Amplify, you can deploy your Next.js frontend to:

- **Vercel** (recommended for Next.js)
- **Netlify**
- **CloudFront + S3** (static export)
- **Another ECS service** (if you need full control)

Just update the `NEXT_PUBLIC_API_URL` environment variable to point to your backend ALB.
