# CPM Billing Lambda — bills campaigns daily based on incremental post views
# Runs as the final step in the virality-sync Step Function (every 12h)
# The lambda itself deduplicates to once per day via charge_date check

# ECR Repository
resource "aws_ecr_repository" "cpm_billing_lambda" {
  name                 = var.environment == "prod" ? "${var.project_name}-cpm-billing-lambda" : "${var.project_name}-cpm-billing-lambda-${var.environment}"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = var.environment == "prod" ? "${var.project_name}-cpm-billing-lambda" : "${var.project_name}-cpm-billing-lambda-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_ecr_lifecycle_policy" "cpm_billing_lambda" {
  repository = aws_ecr_repository.cpm_billing_lambda.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 5 images"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 5
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# IAM Role
resource "aws_iam_role" "cpm_billing_lambda" {
  name = "${var.project_name}-cpm-billing-lambda-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "${var.project_name}-cpm-billing-lambda-role-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_iam_role_policy_attachment" "cpm_billing_lambda_basic" {
  role       = aws_iam_role.cpm_billing_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda Function
resource "aws_lambda_function" "cpm_billing" {
  function_name = "${var.project_name}-cpm-billing-${var.environment}"
  role          = aws_iam_role.cpm_billing_lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.cpm_billing_lambda.repository_url}:latest"
  timeout       = 300
  memory_size   = 256

  image_config {
    command = ["lambda-cpm-billing/dist/handler.handler"]
  }

  environment {
    variables = {
      DATABASE_URL      = var.database_url
      STRIPE_SECRET_KEY = var.stripe_secret_key
      RESEND_API_KEY    = var.resend_api_key
      FRONTEND_URL      = var.environment == "prod" ? "https://platform.cuttr.com" : "https://staging.platform.cuttr.com"
    }
  }

  depends_on = [aws_iam_role_policy_attachment.cpm_billing_lambda_basic]
  lifecycle { ignore_changes = [image_uri] }

  tags = {
    Name        = "${var.project_name}-cpm-billing-${var.environment}"
    Environment = var.environment
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "cpm_billing_lambda" {
  name              = "/aws/lambda/${var.project_name}-cpm-billing-${var.environment}"
  retention_in_days = 14

  tags = {
    Name        = "${var.project_name}-cpm-billing-logs-${var.environment}"
    Environment = var.environment
  }
}
