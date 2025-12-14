#!/bin/bash

# Clipster Deployment Script
# This script automates the deployment of the Clipster application to AWS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v terraform &> /dev/null; then
        log_error "Terraform is not installed"
        exit 1
    fi

    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi

    log_info "All prerequisites met ✓"
}

# Initialize Terraform
init_terraform() {
    log_info "Initializing Terraform..."
    terraform init
}

# Deploy infrastructure
deploy_infrastructure() {
    log_info "Deploying infrastructure..."

    terraform plan -out=tfplan

    read -p "Review the plan above. Continue with apply? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        log_warn "Deployment cancelled"
        exit 0
    fi

    terraform apply tfplan
    rm tfplan

    log_info "Infrastructure deployed ✓"
}

# Build and push Docker image
build_and_push_backend() {
    log_info "Building and pushing backend Docker image..."

    # Get ECR repository URL
    ECR_REPO=$(terraform output -raw ecr_repository_url)
    AWS_REGION=$(terraform output -raw aws_region || echo "us-west-2")
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

    log_info "ECR Repository: $ECR_REPO"

    # Login to ECR
    log_info "Logging into ECR..."
    aws ecr get-login-password --region $AWS_REGION | \
        docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

    # Build image
    log_info "Building Docker image..."
    cd ..
    docker build -t clipster-backend:latest -f backend/Dockerfile .

    # Tag image
    log_info "Tagging image..."
    docker tag clipster-backend:latest $ECR_REPO:latest

    # Push image
    log_info "Pushing image to ECR..."
    docker push $ECR_REPO:latest

    cd infra
    log_info "Backend image pushed ✓"
}

# Update ECS service
update_ecs_service() {
    log_info "Updating ECS service..."

    AWS_REGION=$(terraform output -raw aws_region || echo "us-west-2")
    CLUSTER_NAME=$(terraform output -raw ecs_cluster_name)
    SERVICE_NAME=$(terraform output -raw ecs_service_name)

    aws ecs update-service \
        --cluster $CLUSTER_NAME \
        --service $SERVICE_NAME \
        --force-new-deployment \
        --region $AWS_REGION > /dev/null

    log_info "ECS service updated ✓"
}

# Display outputs
display_outputs() {
    log_info "Deployment complete! 🎉"
    echo ""
    echo "======================================"
    echo "         Deployment Summary"
    echo "======================================"
    echo ""
    echo "Backend API URL:"
    terraform output backend_api_url
    echo ""
    echo "Frontend URL:"
    terraform output amplify_app_url
    echo ""
    echo "S3 Bucket:"
    terraform output s3_bucket_name
    echo ""
    echo "CloudWatch Logs:"
    terraform output cloudwatch_log_group
    echo ""
    echo "======================================"
    echo ""
    log_info "Check backend health:"
    echo "curl https://$(terraform output -raw alb_dns_name)/health"
    echo ""
    log_info "View backend logs:"
    echo "aws logs tail $(terraform output -raw cloudwatch_log_group) --follow"
}

# Main deployment flow
main() {
    log_info "Starting Clipster deployment..."

    check_prerequisites

    # Check if terraform.tfvars exists
    if [ ! -f "terraform.tfvars" ]; then
        log_error "terraform.tfvars not found!"
        log_info "Copy terraform.tfvars.example and fill in your values"
        exit 1
    fi

    init_terraform
    deploy_infrastructure
    build_and_push_backend
    update_ecs_service
    display_outputs
}

# Run main function
main
