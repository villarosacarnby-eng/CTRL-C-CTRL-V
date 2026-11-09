# Hope, Inc. ERP – Enterprise Resource Planning System

## Project Overview

Hope, Inc. ERP is a web-based Enterprise Resource Planning (ERP) system developed to help businesses manage and organize their daily operations in one centralized platform.

The system provides an organized way to handle important company information, including customer records, product information, employee records, sales transactions, and business reports. It aims to reduce manual work, improve data organization, and make business processes easier and more efficient.

The website is designed with a simple and user-friendly interface, allowing users to navigate through different modules based on their assigned roles and permissions.

## Project Objectives

The main objectives of Hope, Inc. ERP are:

- To provide a centralized platform for managing business information.
- To simplify customer, product, employee, and sales management.
- To improve the accuracy and organization of business records.
- To provide a secure system with role-based access and permissions.
- To make business transactions and reporting more efficient.
- To maintain historical records of important business activities.

## Key Features and Functionalities

### 1. Landing Page
Provides an introduction to the Hope, Inc. ERP system and allows visitors to access the login and registration pages.

### 2. Authentication and Account Management
- User registration
- User login and logout
- Forgot password functionality
- Password reset functionality
- Account access control

### 3. Dashboard
Provides an overview of the company's operations. The dashboard displays information and available features based on the user's assigned role.

### 4. Customer Management
Allows authorized users to:
- Add new customer records.
- View customer information.
- Update existing customer details.
- Deactivate customer records.
- Manage customer payment terms.

### 5. Product Management
Provides functionality for managing company products, including:
- Adding new products.
- Viewing product information.
- Updating product details.
- Managing product prices.
- Tracking product price history.

### 6. Human Resource Management
Organizes employee-related information through the following sections:
- Employee Records
- Job Management
- Department Management
- Job History

### 7. Sales Management
Allows authorized users to manage company sales transactions, including:
- Viewing sales records.
- Creating new sales transactions.
- Editing existing sales information.
- Viewing individual sales details.
- Managing products included in each transaction.

### 8. Reports
Provides access to business reports that help users review company information and monitor business transactions. Reports can also be printed or saved as PDF files.

### 9. User Management
Allows authorized administrators to manage registered accounts, assign user roles, update account permissions, and control system access.

### 10. System Settings
Provides a dedicated section for system-related settings.

## User Roles and Permissions

The system implements role-based access control to ensure that users can only access features permitted by their assigned roles.

| User Role | Description |
|---|---|
| Superadmin | Has the highest level of access and manages administrators, users, roles, and system permissions. |
| Admin | Handles everyday business operations and manages authorized company modules. |
| User | Has limited access to specific features based on permissions granted by administrators. |

## Technologies Used

The following technologies and tools are used in developing the system:

| Technology | Purpose |
|---|---|
| HTML5 | Provides the structure of the website. |
| CSS3 | Handles the website's design, layout, and styling. |
| JavaScript | Provides interactive features and system functionality. |
| Supabase | Provides backend services, authentication, and database connectivity. |
| PostgreSQL | Stores and manages the system's data. |
| GitHub | Used for source code management, collaboration, and project documentation. |
| Visual Studio Code | Used as the development environment. |

## Database Management

Hope, Inc. ERP uses Supabase with PostgreSQL as its database system.

The database stores important information, including:

- Employee records
- Department records
- Job positions and history
- Customer information
- Product information
- Sales transactions
- Sales details
- Product price history
- User profiles and permissions

The system also uses Row Level Security (RLS) to control access to database records based on user roles and permissions.

## System Security

Security is an important part of the Hope, Inc. ERP system. The website implements:

- User authentication through Supabase.
- Role-based access control.
- Database-level security using Row Level Security (RLS).
- Restricted access to authorized modules.
- Account blocking functionality.
- Record deactivation instead of permanent deletion to preserve historical information.

## Project Structure

The repository contains the website designs, database files, and testing documentation.

Main website files include:

- `index.html` – Landing page
- `login.html` – Login page
- `register.html` – Registration page
- `forgot-password.html` – Forgot password page
- `reset-password.html` – Password reset page
- `dashboard.html` – Main dashboard
- `customers.html` – Customer management
- `products.html` – Product management
- `price-history.html` – Product price history
- `hr.html` – Human resource management
- `hr-jobs.html` – Job management
- `hr-departments.html` – Department management
- `job-history.html` – Employee job history
- `sales.html` – Sales management
- `sale-form.html` – Sales transaction form
- `sale-details.html` – Sales transaction details
- `reports.html` – Business reports
- `users.html` – User management
- `settings.html` – System settings
- `style.css` – Website styling
- `config.js` – Supabase connection configuration
- `core.js` – Core system functionality
- `auth.js` – Authentication functionality
- `pages.js` – Page functionality and operations
- `supabase-schema.sql` – Database structure and security policies

## Installation and Setup

1. Clone or download this repository.
2. Open the project folder using Visual Studio Code.
3. Create a Supabase project.
4. Open the Supabase SQL Editor.
5. Import and execute the `supabase-schema.sql` file.
6. Open `config.js` and configure your Supabase Project URL and anon/publishable key.
7. Install the Live Server extension in Visual Studio Code.
8. Open `index.html` using Live Server.
9. Register an account and configure the appropriate user role in Supabase.

**Important:** Never expose your Supabase service role key or other private credentials in the repository.

## Project Purpose

Hope, Inc. ERP aims to provide a practical and organized solution for managing business operations. Through its different modules, the system helps businesses maintain accurate records, manage transactions, monitor employee information, and control access to important company data.

By integrating frontend technologies with a centralized database, the project demonstrates how an ERP system can support business processes through an accessible and organized web application.

---

**Project Name:** Hope, Inc. ERP  
**Repository:** CTRL-C-CTRL-V
