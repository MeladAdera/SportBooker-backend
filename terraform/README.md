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
app_domain        = "your-domain.com"
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

| Secret Name | Value |
|---|---|
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
  --name "/sportbooker/production/SENDGRID_API_KEY" \
  --value "SG.your-new-key" \
  --type SecureString \
  --overwrite \
  --region ap-south-1

# Force redeploy to pick up new secrets
aws ecs update-service --cluster sportbooker-cluster --service sportbooker-service --force-new-deployment --region ap-south-1
```

## Adding a Custom Domain (Later)

When you purchase a domain:

1. Create a hosted zone in Route 53
2. Create an ACM certificate (with DNS validation)
3. Add an HTTPS listener to the ALB
4. Add a Route 53 alias record pointing to the ALB

## Tearing Down

```bash
terraform destroy

# Then destroy the state backend (if you want everything gone)
cd bootstrap
terraform destroy
```
