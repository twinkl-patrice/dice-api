resource "aws_dynamodb_table" "rolls" {
    name         = "${var.service_name}-rolls"
    billing_mode = "PAY_PER_REQUEST"
    hash_key     = "pk"

    attribute {
        name = "pk"
        type = "S"
    }

    stream_enabled   = true
    stream_view_type = "NEW_IMAGE"

    tags = {
        Name = "${var.service_name}-rolls"
    }
}
