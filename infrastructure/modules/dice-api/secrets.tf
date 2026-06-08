resource "random_password" "api_key" {
    length  = 32
    special = false
}

resource "aws_secretsmanager_secret" "api_key" {
    name        = "${var.service_name}-api-key"
    description = "API key for the dice-api reset endpoint"

    tags = {
        Name = "${var.service_name}-api-key"
    }
}

resource "aws_secretsmanager_secret_version" "api_key" {
    secret_id     = aws_secretsmanager_secret.api_key.id
    secret_string = random_password.api_key.result
}
