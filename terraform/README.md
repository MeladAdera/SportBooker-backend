# SportBooker — AWS Infrastructure (Terraform)

## Architecture

```
Internet → ALB (:80) → ECS Fargate (:3000) → RDS PostgreSQL (private)
                                             → S3 (uploads)
```

- **Compute:** ECS Fargate (0.5 vCPU, 1 GB) in public subnets
- **Database:** RDS PostgreSQL 15 (db.t4g.micro) in private subnets
- **Storage:** S3 for venue image uploads
- **CI/CD:** GitHub Actions → ECR → ECS (OIDC, no long-lived credentials)
- **Secrets:** SSM Parameter Store (SecureString)
- **Logs:** CloudWatch Logs (30-day retention)
- **Estimated cost:** ~$47/mo (ap-south-1)

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5
- [AWS CLI](https://aws.amazon.com/cli/) configured with appropriate permissions
- A GitHub repository for the CI/CD pipeline

## Deployment Steps

### Step 1: Bootstrap Terraform State Backend

This creates the S3 bucket and DynamoDB table for remote state.

```bash
cd terraform/bootstrap
terraform init
terraform apply
cd ..
```

### Step 2: Create Your Variables File

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your values:

```hcl
aws_region        = "ap-south-1"
TENANT_HOST_SUFFIX        = "your-domain.com"
jwt_access_secret = "$(openssl rand -hex 32)"  # generate a random secret
github_repo       = "your-username/SportBooker"
github_branch     = "main"
```

### Step 3: Deploy Infrastructure

```bash
terraform init
terraform plan        # review what will be created
terraform apply       # create everything
```

Save the outputs — you'll need them:

```bash
terraform output
```

### Step 4: Push Your First Docker Image

Before the ECS service can start, it needs an image in ECR.

```bash
# Get your ECR URL from Terraform output
ECR_URL=$(terraform output -raw ecr_repository_url)

# Login to ECR
aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin $ECR_URL

# Build and push (from project root)
cd ..
docker build -t $ECR_URL:latest .
docker push $ECR_URL:latest
```

### Step 5: Force ECS to Pick Up the Image

```bash
aws ecs update-service \
  --cluster sportbooker-cluster \
  --service sportbooker-service \
  --force-new-deployment \
  --region ap-south-1
```

### Step 6: Configure GitHub Actions

Add this secret to your GitHub repository (Settings → Secrets → Actions):

| Secret Name    | Value                                               |
| -------------- | --------------------------------------------------- |
| `AWS_ROLE_ARN` | The `github_actions_role_arn` from terraform output |

After this, every push to `main` will automatically build and deploy.

### Step 7: Verify

```bash
# Get the ALB URL
ALB_URL=$(terraform output -raw alb_dns_name)
curl http://$ALB_URL
```

## Useful Commands

```bash
# View ECS logs
aws logs tail /ecs/sportbooker --follow --region ap-south-1

# Force redeploy (same image)
aws ecs update-service --cluster sportbooker-cluster --service sportbooker-service --force-new-deployment --region ap-south-1

# SSH into task (ECS Exec — requires setup)
# aws ecs execute-command --cluster sportbooker-cluster --task <task-id> --container sportbooker --interactive --command "/bin/sh"

# Check ECS service status
aws ecs describe-services --cluster sportbooker-cluster --services sportbooker-service --region ap-south-1 --query 'services[0].{status:status,running:runningCount,desired:desiredCount,events:events[:3]}'
```

## Updating Secrets

Secrets are stored in SSM Parameter Store under `/sportbooker/production/`.

```bash
# Update a secret
aws ssm put-parameter \
  --name "/sportbooker/production/RESEND_API_KEY" \
  --value "re_your-new-key" \
  --type SecureString \
  --overwrite \
  --region ap-south-1

# Update password-reset template ID
aws ssm put-parameter \
  --name "/sportbooker/production/RESEND_TEMPLATE_PASSWORD_RESET_ID" \
  --value "432bfd62-0d5e-48cf-ad61-fd3d782b6698" \
  --type SecureString \
  --overwrite \
  --region ap-south-1

# Update email-verification template ID
aws ssm put-parameter \
  --name "/sportbooker/production/RESEND_TEMPLATE_EMAIL_VERIFICATION_ID" \
  --value "672a13df-d7f1-499e-9449-d55fb02d26a8" \
  --type SecureString \
  --overwrite \
  --region ap-south-1

# Update waitlist-expired-refund template ID
aws ssm put-parameter \
  --name "/sportbooker/production/RESEND_TEMPLATE_WAITLIST_EXPIRED_REFUND_ID" \
  --value "e464ed47-8960-4722-b2a1-0e2667813de1" \
  --type SecureString \
  --overwrite \
  --region ap-south-1

# Force redeploy to pick up new secrets
aws ecs update-service --cluster sportbooker-cluster --service sportbooker-service --force-new-deployment --region ap-south-1
```

## Custom Domain & HTTPS

Managed via `dns.tf` and `alb.tf`. Domain layout:

| URL                      | Target    | Purpose                                                 |
| ------------------------ | --------- | ------------------------------------------------------- |
| `api.sportbooker.net`    | ALB (ECS) | NestJS API                                              |
| `app.sportbooker.net`    | Vercel    | Frontend SPA                                            |
| `{slug}.sportbooker.net` | Vercel    | Tenant subdomains (frontend reads subdomain, calls API) |
| `sportbooker.net`        | ALB → 301 | Redirects to `app.sportbooker.net`                      |

Infrastructure managed by Terraform:

- **ACM certificate** for `sportbooker.net` + `*.sportbooker.net` (DNS validation)
- **HTTPS listener** (:443) forwards to ECS; listener rule redirects apex to `app.`
- **HTTP listener** (:80) redirects 301 → HTTPS
- **Route 53**: `api.` A-alias → ALB, `app.` + `*.` CNAME → `cname.vercel-dns.com`
- **CORS**: static origins from `CORS_ORIGINS` + dynamic `*.sportbooker.net` matching

### Vercel Frontend Setup

In the Vercel dashboard for the frontend project:

1. Go to **Settings → Domains**
2. Add `app.sportbooker.net` — DNS is already pointing to Vercel
3. Add `*.sportbooker.net` (wildcard) — requires **Vercel Pro plan** ($20/mo)
4. Vercel will issue its own TLS certs for these domains automatically

If on Vercel Hobby (free), wildcard domains are not available. Tenant selection
would need to happen in-app instead of via subdomain URLs.

## Tearing Down

```bash
terraform destroy

# Then destroy the state backend (if you want everything gone)
cd bootstrap
terraform destroy
```
