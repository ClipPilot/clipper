# Secrets Manager for sensitive environment variables

# OpenAI API Key
resource "aws_secretsmanager_secret" "openai_api_key" {
  name                    = "${var.project_name}/openai-api-key-${var.environment}"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-openai-api-key-${var.environment}"
  }
}

resource "aws_secretsmanager_secret_version" "openai_api_key" {
  secret_id     = aws_secretsmanager_secret.openai_api_key.id
  secret_string = var.openai_api_key
}

# Deepgram API Key
resource "aws_secretsmanager_secret" "deepgram_api_key" {
  name                    = "${var.project_name}/deepgram-api-key-${var.environment}"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-deepgram-api-key-${var.environment}"
  }
}

resource "aws_secretsmanager_secret_version" "deepgram_api_key" {
  secret_id     = aws_secretsmanager_secret.deepgram_api_key.id
  secret_string = var.deepgram_api_key
}

# Database URL
resource "aws_secretsmanager_secret" "database_url" {
  name                    = "${var.project_name}/database-url-${var.environment}"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-database-url-${var.environment}"
  }
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = var.database_url
}

# Supabase Anon Key
resource "aws_secretsmanager_secret" "supabase_anon_key" {
  name                    = "${var.project_name}/supabase-anon-key-${var.environment}"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-supabase-anon-key-${var.environment}"
  }
}

resource "aws_secretsmanager_secret_version" "supabase_anon_key" {
  secret_id     = aws_secretsmanager_secret.supabase_anon_key.id
  secret_string = var.supabase_anon_key
}

resource "aws_secretsmanager_secret" "internal_api_key" {
  name                    = "${var.project_name}/internal-api-key-${var.environment}"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-internal-api-key-${var.environment}"
  }
}

resource "aws_secretsmanager_secret_version" "internal_api_key" {
  secret_id     = aws_secretsmanager_secret.internal_api_key.id
  secret_string = var.internal_api_key
}

# Stripe Secret Key
resource "aws_secretsmanager_secret" "stripe_secret_key" {
  name                    = "${var.project_name}/stripe-secret-key-${var.environment}"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-stripe-secret-key-${var.environment}"
  }
}

resource "aws_secretsmanager_secret_version" "stripe_secret_key" {
  secret_id     = aws_secretsmanager_secret.stripe_secret_key.id
  secret_string = var.stripe_secret_key
}

# Stripe Webhook Secret
resource "aws_secretsmanager_secret" "stripe_webhook_secret" {
  name                    = "${var.project_name}/stripe-webhook-secret-${var.environment}"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-stripe-webhook-secret-${var.environment}"
  }
}

resource "aws_secretsmanager_secret_version" "stripe_webhook_secret" {
  secret_id     = aws_secretsmanager_secret.stripe_webhook_secret.id
  secret_string = var.stripe_webhook_secret
}

# Resend API Key
resource "aws_secretsmanager_secret" "resend_api_key" {
  name                    = "${var.project_name}/resend-api-key-${var.environment}"
  recovery_window_in_days = 7

  tags = {
    Name = "${var.project_name}-resend-api-key-${var.environment}"
  }
}

resource "aws_secretsmanager_secret_version" "resend_api_key" {
  secret_id     = aws_secretsmanager_secret.resend_api_key.id
  secret_string = var.resend_api_key
}
