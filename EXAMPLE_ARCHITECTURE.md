# Architecture Documentation

This document provides an overview of the application architecture, including database schema, API endpoints, and view components.

Generated on: 2025-09-12T10:00:00.000Z

## Table of Contents

1. [Database Schema](#database-schema)
2. [API Endpoints](#api-endpoints)
3. [Views and Components](#views-and-components)
4. [Data Flow](#data-flow)

## Database Schema

### Tables

#### users

- **ID**: user_model_id
- **User-specific data**: Yes
- **State**: persistent
- **CRUD operations**: Yes

**Fields:**

| Field Name | Data Type | Size | Required | Key | Searchable | Notes |
|------------|-----------|------|----------|-----|------------|-------|
| id | string | 36 | Yes | primary | No | System |
| email | string | 255 | Yes | unique | Yes | - |
| name | string | 255 | No | - | Yes | - |
| password_hash | string | 255 | Yes | - | No | System |
| created_at | datetime | - | Yes | - | No | System |
| updated_at | datetime | - | Yes | - | No | System |

**Authentication Requirements:**
- Add: authenticated
- Get: authenticated_self
- Update: authenticated_self
- Delete: admin

#### products

- **ID**: product_model_id
- **User-specific data**: No
- **State**: persistent
- **CRUD operations**: Yes

**Fields:**

| Field Name | Data Type | Size | Required | Key | Searchable | Notes |
|------------|-----------|------|----------|-----|------------|-------|
| id | string | 36 | Yes | primary | No | System |
| name | string | 255 | Yes | - | Yes | - |
| description | text | - | No | - | Yes | - |
| price | decimal | 10,2 | Yes | - | No | - |
| image_url | string | 500 | No | - | No | Image |
| category_id | string | 36 | No | foreign | No | - |
| stock | integer | - | Yes | - | No | - |

**Authentication Requirements:**
- Add: admin
- Get: public
- Update: admin
- Delete: admin

### Relationships

#### users Relationships

#### products Relationships

- **products.category_id** → **categories.id** (many-to-one)

## API Endpoints

### GET /api/products

- **ID**: api_products_list
- **Authentication Required**: No
- **User Tier**: None

**Input Parameters:** None

**Output Format (ProductListResponse):**
*List of products with pagination*

| Property | Type | Required | Description | Constraints |
|----------|------|----------|-------------|-------------|
| products | array<Product> | Yes | Array of product objects | - |
| total | number | Yes | Total number of products | - |
| page | number | Yes | Current page number | min:1 |
| pageSize | number | Yes | Items per page | min:1, max:100 |

**products Item Structure (Product):**
*Product information*

| Property | Type | Required | Description | Constraints |
|----------|------|----------|-------------|-------------|
| id | string | Yes | Product ID | - |
| name | string | Yes | Product name | - |
| description | string | No | Product description | - |
| price | number | Yes | Product price | min:0 |
| imageUrl | string | No | Product image URL | - |
| stock | number | Yes | Available stock | min:0 |

### POST /api/auth/login

- **ID**: api_auth_login
- **Authentication Required**: No
- **User Tier**: None

**Input Parameters (LoginRequest):**
*User login credentials*

| Property | Type | Required | Description | Constraints |
|----------|------|----------|-------------|-------------|
| email | string | Yes | User email | email |
| password | string | Yes | User password | minLen:8 |

**Output Format (LoginResponse):**
*Authentication response*

| Property | Type | Required | Description | Constraints |
|----------|------|----------|-------------|-------------|
| token | string | Yes | JWT authentication token | - |
| user | object (UserProfile) | Yes | User profile information | - |

**user Structure (UserProfile):**
*User profile data*

| Property | Type | Required | Description | Constraints |
|----------|------|----------|-------------|-------------|
| id | string | Yes | User ID | - |
| email | string | Yes | User email | - |
| name | string | No | User name | - |

## Views and Components

### Image Sections

#### Hero Image

- **ID**: hero_image_view
- **Type**: image

**Description:**
Main hero banner image for the homepage

### Buttons

#### Shop Now Button

- **ID**: shop_now_btn
- **Type**: button
- **Consumes APIs**:
  - GET /api/products (Public)

**Description:**
Call to action button that links to products page

### Text Sections

#### Welcome Message

- **ID**: welcome_text
- **Type**: text

**Description:**
Welcome text explaining the store's value proposition

## Data Flow

### API to View Mapping

- **GET /api/products** is used by:
  - Shop Now Button
  - Product Grid

### Unused APIs

- POST /api/auth/login

### Pages

| Page Name | Access Level | User Tier | Description |
|-----------|--------------|-----------|-------------|
| Home (Home) | public | all | Landing page with hero and features |
| Products | public | all | Product listing and search |
| Login | public | all | User authentication page |
| Dashboard | authenticated | all | User dashboard |
| Admin | admin | admin | Admin control panel |
