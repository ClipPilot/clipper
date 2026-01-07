# Lambda function for face detection using Python + MediaPipe
# Fast, reliable face detection without native compilation issues

# ECR Repository for Face Detect Lambda
resource "aws_ecr_repository" "face_detect_lambda" {
  name                 = "${var.project_name}-face-detect-lambda"
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name = "${var.project_name}-face-detect-lambda"
  }
}

resource "aws_ecr_lifecycle_policy" "face_detect_lambda" {
  repository = aws_ecr_repository.face_detect_lambda.name

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

# IAM Role for Face Detect Lambda
resource "aws_iam_role" "face_detect_lambda" {
  name = "${var.project_name}-face-detect-lambda-role"

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
    Name = "${var.project_name}-face-detect-lambda-role"
  }
}

# Lambda basic execution policy
resource "aws_iam_role_policy_attachment" "face_detect_lambda_basic" {
  role       = aws_iam_role.face_detect_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# S3 access policy for Face Detect Lambda
resource "aws_iam_role_policy" "face_detect_lambda_s3" {
  name = "${var.project_name}-face-detect-lambda-s3-policy"
  role = aws_iam_role.face_detect_lambda.id

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

# Face Detect Lambda Function
resource "aws_lambda_function" "face_detect" {
  function_name = "${var.project_name}-face-detect-${var.environment}"
  role          = aws_iam_role.face_detect_lambda.arn
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.face_detect_lambda.repository_url}:latest"
  timeout       = 900  # 15 minutes (max) for video processing at 15 FPS
  memory_size   = 4096 # 4GB = ~2.5 vCPUs for parallel frame processing

  environment {
    variables = {
      ENVIRONMENT = var.environment
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.face_detect_lambda_basic,
    aws_iam_role_policy.face_detect_lambda_s3
  ]

  lifecycle {
    ignore_changes = [image_uri]
  }

  tags = {
    Name        = "${var.project_name}-face-detect-${var.environment}"
    Environment = var.environment
  }
}

# CloudWatch Log Group for Face Detect Lambda
resource "aws_cloudwatch_log_group" "face_detect_lambda" {
  name              = "/aws/lambda/${var.project_name}-face-detect-${var.environment}"
  retention_in_days = 14

  tags = {
    Name = "${var.project_name}-face-detect-logs"
  }
}

# Lambda Function URL for direct HTTP invocation
resource "aws_lambda_function_url" "face_detect" {
  function_name      = aws_lambda_function.face_detect.function_name
  authorization_type = "AWS_IAM"

  cors {
    allow_origins     = ["*"]
    allow_methods     = ["POST"]
    allow_headers     = ["*"]
    max_age           = 86400
  }
}

# Allow ECS backend tasks to invoke this Lambda
resource "aws_iam_role_policy" "ecs_task_invoke_face_detect" {
  name = "${var.project_name}-ecs-task-invoke-face-detect-${var.environment}"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = aws_lambda_function.face_detect.arn
      }
    ]
  })
}

# Output the Lambda ARN and Function URL
output "face_detect_lambda_arn" {
  description = "ARN of the face detect Lambda function"
  value       = aws_lambda_function.face_detect.arn
}

output "face_detect_lambda_function_url" {
  description = "Function URL of the face detect Lambda"
  value       = aws_lambda_function_url.face_detect.function_url
}
