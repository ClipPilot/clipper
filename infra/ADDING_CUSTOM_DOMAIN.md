# Adding Custom Domain with HTTPS

Currently, your backend uses HTTP with the ALB DNS name:
```
http://clipster-alb-prod-xxxxx.us-west-2.elb.amazonaws.com
```

When you're ready to use a custom domain (e.g., `api.yourdomain.com`) with HTTPS, follow these steps:

## Prerequisites

- ✅ Domain registered in GoDaddy (or any DNS provider)
- ✅ Access to GoDaddy DNS settings

## Step 1: Update Terraform Configuration

### 1. Edit `infra/alb.tf`

Uncomment the HTTPS listener and ACM certificate sections (lines 56-98):

```hcl
# HTTPS Listener
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.backend.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.backend.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }

  depends_on = [aws_acm_certificate_validation.backend]
}

# ACM Certificate
resource "aws_acm_certificate" "backend" {
  domain_name       = "api.yourdomain.com"  # UPDATE THIS!
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.project_name}-cert-${var.environment}"
  }
}

resource "aws_acm_certificate_validation" "backend" {
  certificate_arn = aws_acm_certificate.backend.arn

  timeouts {
    create = "5m"
  }
}
```

### 2. Update HTTP Listener to Redirect

Change the HTTP listener to redirect to HTTPS:

```hcl
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.backend.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}
```

### 3. Update Amplify Environment Variable

In `infra/amplify.tf`, change HTTP to HTTPS:

```hcl
environment_variables = {
  NEXT_PUBLIC_API_URL = "https://api.yourdomain.com/api"  # Update this
  NODE_ENV            = "production"
  ...
}
```

### 4. Update Outputs

In `infra/outputs.tf`:

```hcl
output "backend_api_url" {
  description = "Backend API URL"
  value       = "https://api.yourdomain.com/api"  # Update this
}
```

## Step 2: Apply Terraform

```bash
cd infra
terraform plan
terraform apply
```

Terraform will:
1. Create ACM certificate
2. Output DNS validation records
3. Wait for validation (you'll see it pending)

## Step 3: Add DNS Records to GoDaddy

After `terraform apply`, you'll see output like:

```
ACM Certificate Validation Records:
Name: _abc123.api.yourdomain.com
Type: CNAME
Value: _xyz789.acm-validations.aws.
```

### Add to GoDaddy:

1. Log in to GoDaddy
2. Go to **DNS Management** for your domain
3. Click **Add** new record
4. Select type: **CNAME**
5. Enter:
   - **Name**: `_abc123.api` (the part before your domain)
   - **Value**: `_xyz789.acm-validations.aws.` (from Terraform output)
   - **TTL**: 600 (10 minutes)
6. Click **Save**

## Step 4: Wait for Validation

ACM will automatically validate once DNS propagates (~5-10 minutes).

Check status:
```bash
aws acm describe-certificate \
  --certificate-arn $(terraform output -raw certificate_arn) \
  --region us-west-2
```

Look for: `"Status": "ISSUED"`

## Step 5: Add A Record for Your API Domain

Once certificate is validated, add an A record pointing to the ALB:

### In GoDaddy:

1. Go to **DNS Management**
2. Click **Add** new record
3. Select type: **A**
4. Enter:
   - **Name**: `api` (for api.yourdomain.com)
   - **Value**: Click **Add** → Select **Alias**
   - **Alias to**: Get ALB DNS from Terraform output

OR use CNAME (easier):

1. Select type: **CNAME**
2. Enter:
   - **Name**: `api`
   - **Value**: `clipster-alb-prod-xxxxx.us-west-2.elb.amazonaws.com` (from Terraform output)
   - **TTL**: 600

3. Click **Save**

## Step 6: Verify

Wait a few minutes for DNS to propagate, then test:

```bash
# Test HTTPS
curl https://api.yourdomain.com/health

# Should return:
# {"status":"healthy","timestamp":"...","service":"clipster-backend"}

# Test redirect from HTTP to HTTPS
curl -I http://api.yourdomain.com/health
# Should show: HTTP/1.1 301 Moved Permanently
```

## Step 7: Update Frontend

Push the Terraform changes to trigger frontend rebuild with new HTTPS URL:

```bash
git add infra/
git commit -m "Add custom domain with HTTPS"
git push origin main
```

Amplify will rebuild with the new `NEXT_PUBLIC_API_URL`.

## Troubleshooting

### Certificate validation stuck?

**Check DNS records:**
```bash
dig _abc123.api.yourdomain.com CNAME
```

Should return the ACM validation record.

**Common issues:**
- Wrong CNAME value
- Missing trailing dot in CNAME value
- DNS not propagated yet (wait 10-15 minutes)

### Domain not resolving?

**Check DNS:**
```bash
dig api.yourdomain.com
```

Should return the ALB IP address.

**Common issues:**
- Wrong A/CNAME record
- TTL too high (old DNS cached)
- DNS not propagated

### Certificate not attaching to ALB?

Check Terraform state:
```bash
terraform state list | grep certificate
terraform state show aws_acm_certificate.backend
```

## Cost

ACM certificates are **FREE** when used with AWS services like ALB!

## Alternative: Use Route 53 (Recommended)

If you want easier DNS management:

1. Create Route 53 hosted zone for your domain
2. Update nameservers in GoDaddy to Route 53's NS records
3. Terraform can automatically create DNS records
4. Certificate validation is automatic

See `infra/route53.tf.example` for configuration.

## Notes

- ACM certificates auto-renew (no manual work needed!)
- Supports multiple domains/subdomains
- Can add both `api.yourdomain.com` and `www.api.yourdomain.com`
- HTTPS is recommended for production

## Next Steps

After custom domain is working:

1. ✅ Update CORS in backend to use your domain
2. ✅ Update Supabase redirect URLs
3. ✅ Update any OAuth callback URLs
4. ✅ Consider adding CDN (CloudFront) for better performance
