variable "service_name" {
    description = "Name of the service"
    type        = string
    default     = "dice-api"
}

variable "environment" {
    description = "Deployment environment"
    type        = string
}

variable "aws_region" {
    description = "AWS region"
    type        = string
}

variable "account_id" {
    description = "AWS account ID"
    type        = string
}

variable "dist_path" {
    description = "Path to the built Lambda zip files"
    type        = string
}

variable "enable_stream_processor" {
    description = "Enable DynamoDB Stream processor event source mapping"
    type        = bool
    default     = false
}

variable "enable_direct_publish" {
    description = "Enable direct SNS publish from the roll Lambda"
    type        = bool
    default     = true
}

locals {
    validate_publish_paths = (
        var.enable_direct_publish && var.enable_stream_processor
        ? tobool("ERROR: Direct publish and stream processor cannot both be enabled — stats will double-count rolls")
        : true
    )
}
