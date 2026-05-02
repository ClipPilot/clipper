# Lambda function for scene detection using Python + OpenCV
# Detects scene boundaries by analyzing frame differences

# ECR Repository for Scene Detect Lambda
# Note: Prod uses 'clipster-scene-detect-lambda', staging uses 'clipster-scene-detect-lambda-staging'
# This separation prevents staging deployments from triggering ECR lifecycle policy
# that could delete production images
resource "aws_ecr_repository" "scene_detect_lambda" {
  name                 = var.environment == "prod" ? "${var.project_name}-scene-detect-lambda" : "${var.project_name}-scene-detect-lambda-${var.environment}"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = var.environment == "prod" ? "${var.project_name}-scene-detect-lambda" : "${var.project_name}-scene-detect-lambda-${var.environment}"
    Environment = var.environment
  }
}

resource "aws_ecr_lifecycle_policy" "scene_detect_lambda" {
  repository = aws_ecr_repository.scene_detect_lambda.name

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

# IAM Role for Scene Detect Lambda
resource "aws_iam_role" "scene_detect_lambda" {
  name = "${var.project_name}-scene-detect-lambda-role-${var.environment}"

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
    Name = "${var.project_name}-scene-detect-lambda-role-${var.environment}"
  }
}

# Lambda basic execution policy
resource "aws_iam_role_policy_attachment" "scene_detect_lambda_basic" {
  role       = aws_iam_role.scene_detect_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# S3 access policy for Scene Detect Lambda
resource "aws_iam_role_policy" "scene_detect_lambda_s3" {
  name = "${var.project_name}-scene-detect-lambda-s3-policy-${var.environment}"
  role = aws_iam_role.scene_detect_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject"
        ]
        Resource = [
          "arn:aws:s3:::${var.project_name}-videos-staging-${data.aws_caller_identity.current.account_id}/*",
          "arn:aws:s3:::${var.project_name}-videos-prod-${data.aws_caller_identity.current.account_id}/*"
        ]
      }
    ]
  })
}

# Scene Detect Lambda Function
resource "aws_lambda_function" "scene_detect" {
  function_name = "${var.project_name}-scene-detect-${var.environment}"
  role          = aws_iam_role.scene_detect_lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.scene_detect_lambda.repository_url}:latest"
  timeout       = 300  # 5 minutes - scene detection is faster than face detection
  memory_size   = 1024 # 1GB - scene detection needs less memory than face detection

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.scene_detect_lambda_basic,
    aws_iam_role_policy.scene_detect_lambda_s3
  ]

  lifecycle {
    ignore_changes = [image_uri]
  }

  tags = {
    Name        = "${var.project_name}-scene-detect-${var.environment}"
    Environment = var.environment
  }
}

# CloudWatch Log Group for Scene Detect Lambda
resource "aws_cloudwatch_log_group" "scene_detect_lambda" {
  name              = "/aws/lambda/${var.project_name}-scene-detect-${var.environment}"
  retention_in_days = 14

  tags = {
    Name = "${var.project_name}-scene-detect-logs-${var.environment}"
  }
}

# Lambda Function URL for direct HTTP invocation
resource "aws_lambda_function_url" "scene_detect" {
  function_name      = aws_lambda_function.scene_detect.function_name
  authorization_type = "AWS_IAM"

  cors {
    allow_origins = ["*"]
    allow_methods = ["POST"]
    allow_headers = ["*"]
    max_age       = 86400
  }
}

# Allow ECS backend tasks to invoke this Lambda
resource "aws_iam_role_policy" "ecs_task_invoke_scene_detect" {
  name = "${var.project_name}-ecs-task-invoke-scene-detect-${var.environment}"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = aws_lambda_function.scene_detect.arn
      }
    ]
  })
}

# Output the Lambda ARN and Function URL
output "scene_detect_lambda_arn" {
  description = "ARN of the scene detect Lambda function"
  value       = aws_lambda_function.scene_detect.arn
}

output "scene_detect_lambda_function_url" {
  description = "Function URL of the scene detect Lambda"
  value       = aws_lambda_function_url.scene_detect.function_url
}
