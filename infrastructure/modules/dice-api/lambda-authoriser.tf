module "lambda_authoriser" {
    source  = "terraform-aws-modules/lambda/aws"
    version = "~> 7.0"

    function_name = "${var.service_name}-authoriser"
    description   = "Dice API - API key authoriser"
    handler       = "authoriser.handler"
    runtime       = "nodejs24.x"
    architectures = ["arm64"]
    timeout       = 5

    create_package         = false
    local_existing_package = "${var.dist_path}/api/authoriser.zip"
    publish                = true

    environment_variables = {
        SECRET_NAME             = aws_secretsmanager_secret.api_key.name
        POWERTOOLS_SERVICE_NAME = var.service_name
        LOG_LEVEL               = "INFO"
    }

    attach_policy_statements = true
    policy_statements = {
        secrets_manager = {
            effect    = "Allow"
            actions   = ["secretsmanager:GetSecretValue"]
            resources = [aws_secretsmanager_secret.api_key.arn]
        }
    }

    allowed_triggers = {
        api_gateway = {
            service    = "apigateway"
            source_arn = "${module.api_gateway.api_execution_arn}/*"
        }
    }

    tags = {
        Name = "${var.service_name}-authoriser"
    }
}
