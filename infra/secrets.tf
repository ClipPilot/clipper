# Secrets Manager for sensitive environment variables

# OpenAI API Key
resource "aws_secretsmanager_secret" "openai_api_key" {
  name                    = "${var.project_name}-${var.environment}/openai-api-key"
  recovery_window_in_days = 0

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
  name                    = "${var.project_name}-${var.environment}/deepgram-api-key"
  recovery_window_in_days = 0

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
  name                    = "${var.project_name}-${var.environment}/database-url"
  recovery_window_in_days = 0

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
  name                    = "${var.project_name}-${var.environment}/supabase-anon-key"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-supabase-anon-key-${var.environment}"
  }
}

resource "aws_secretsmanager_secret_version" "supabase_anon_key" {
  secret_id     = aws_secretsmanager_secret.supabase_anon_key.id
  secret_string = var.supabase_anon_key
}

resource "aws_secretsmanager_secret" "internal_api_key" {
  name                    = "${var.project_name}-${var.environment}/internal-api-key"
  recovery_window_in_days = 0

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
  name                    = "${var.project_name}-${var.environment}/stripe-secret-key"
  recovery_window_in_days = 0

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
  name                    = "${var.project_name}-${var.environment}/stripe-webhook-secret"
  recovery_window_in_days = 0

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
  name                    = "${var.project_name}-${var.environment}/resend-api-key"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-resend-api-key-${var.environment}"
  }
}

resource "aws_secretsmanager_secret_version" "resend_api_key" {
  secret_id     = aws_secretsmanager_secret.resend_api_key.id
  secret_string = var.resend_api_key
}

# Gemini API Key
resource "aws_secretsmanager_secret" "gemini_api_key" {
  name                    = "${var.project_name}-${var.environment}/gemini-api-key"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-gemini-api-key-${var.environment}"
  }
}
resource "aws_secretsmanager_secret_version" "gemini_api_key" {
  secret_id     = aws_secretsmanager_secret.gemini_api_key.id
  secret_string = var.gemini_api_key
}

# Admin JWT Secret
resource "aws_secretsmanager_secret" "admin_jwt_secret" {
  name                    = "${var.project_name}-${var.environment}/admin-jwt-secret"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-admin-jwt-secret-${var.environment}"
  }
}
resource "aws_secretsmanager_secret_version" "admin_jwt_secret" {
  secret_id     = aws_secretsmanager_secret.admin_jwt_secret.id
  secret_string = var.admin_jwt_secret
}

# Sync Key
resource "aws_secretsmanager_secret" "sync_key" {
  name                    = "${var.project_name}-${var.environment}/sync-key"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-sync-key-${var.environment}"
  }
}
resource "aws_secretsmanager_secret_version" "sync_key" {
  secret_id     = aws_secretsmanager_secret.sync_key.id
  secret_string = var.sync_key
}

# ElevenLabs API Key
resource "aws_secretsmanager_secret" "elevenlabs_api_key" {
  name                    = "${var.project_name}-${var.environment}/elevenlabs-api-key"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-elevenlabs-api-key-${var.environment}"
  }
}
resource "aws_secretsmanager_secret_version" "elevenlabs_api_key" {
  secret_id     = aws_secretsmanager_secret.elevenlabs_api_key.id
  secret_string = var.elevenlabs_api_key
}

# FAL API Key
resource "aws_secretsmanager_secret" "fal_key" {
  name                    = "${var.project_name}-${var.environment}/fal-key"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-fal-key-${var.environment}"
  }
}
resource "aws_secretsmanager_secret_version" "fal_key" {
  secret_id     = aws_secretsmanager_secret.fal_key.id
  secret_string = var.fal_key
}

# Ad Posting Webhook Secret
resource "aws_secretsmanager_secret" "ad_posting_webhook_secret" {
  name                    = "${var.project_name}-${var.environment}/ad-posting-webhook-secret"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-ad-posting-webhook-secret-${var.environment}"
  }
}
resource "aws_secretsmanager_secret_version" "ad_posting_webhook_secret" {
  secret_id     = aws_secretsmanager_secret.ad_posting_webhook_secret.id
  secret_string = var.ad_posting_webhook_secret
}

# Google Service Account Private Key (Mass Posting / Drive)
resource "aws_secretsmanager_secret" "google_service_account_private_key" {
  name                    = "${var.project_name}-${var.environment}/google-service-account-private-key"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-google-sa-private-key-${var.environment}"
  }
}
resource "aws_secretsmanager_secret_version" "google_service_account_private_key" {
  secret_id     = aws_secretsmanager_secret.google_service_account_private_key.id
  secret_string = var.google_service_account_private_key
}

# Apify API Token
resource "aws_secretsmanager_secret" "apify_api_token" {
  name                    = "${var.project_name}-${var.environment}/apify-api-token"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-apify-api-token-${var.environment}"
  }
}
resource "aws_secretsmanager_secret_version" "apify_api_token" {
  secret_id     = aws_secretsmanager_secret.apify_api_token.id
  secret_string = var.apify_api_token
}

# SocialData API Key (Twitter/X profile data)
resource "aws_secretsmanager_secret" "socialdata_api_key" {
  name                    = "${var.project_name}-${var.environment}/socialdata-api-key"
  recovery_window_in_days = 0

  tags = {
    Name = "${var.project_name}-socialdata-api-key-${var.environment}"
  }
}
resource "aws_secretsmanager_secret_version" "socialdata_api_key" {
  secret_id     = aws_secretsmanager_secret.socialdata_api_key.id
  secret_string = var.socialdata_api_key
}
