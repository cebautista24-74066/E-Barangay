<p align="center"><a href="https://laravel.com" target="_blank"><img src="https://raw.githubusercontent.com/laravel/art/master/logo-lockup/5%20SVG/2%20CMYK/1%20Full%20Color/laravel-logolockup-cmyk-red.svg" width="400" alt="Laravel Logo"></a></p>

<p align="center">
<a href="https://github.com/laravel/framework/actions"><img src="https://github.com/laravel/framework/workflows/tests/badge.svg" alt="Build Status"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/dt/laravel/framework" alt="Total Downloads"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/v/laravel/framework" alt="Latest Stable Version"></a>
<a href="https://packagist.org/packages/laravel/framework"><img src="https://img.shields.io/packagist/l/laravel/framework" alt="License"></a>
</p>

## E-Barangay Humayingan

This application is the web-based Barangay Information System for Barangay Humayingan. Its requirements are based on the project's Business Case and Preliminary Investigation documents. The unrelated photography and printing shop scope in the Topic Proposal is not part of this system.

The application supports:

- Resident accounts and administrator-only account management.
- Barangay announcements and event notices.
- An administrator-managed catalog of services, requirements, and procedures.
- Resident service requests with optional private document uploads.
- Request status tracking and a permanent status history.
- Complaints, suggestions, and resident feedback.
- In-system and email notifications when a request's status changes.
- Administrator reports and CSV export of service requests.

The initial request workflow is Pending, Processing, Approved or Rejected, and Completed. The barangay should confirm its official services, requirements, and processing procedures before publishing them.

### Local development

1. Configure `.env` for the local database and run `php artisan migrate`.
2. Start the Laravel application with `php artisan serve`.
3. In a separate VS Code terminal, run `npm run dev`. If using PowerShell, use `npm.cmd run dev`.
4. Open the URL printed by `php artisan serve`.

To grant administrator access, register the intended account first, then change that account's `role` from `Resident` to `Administrator` in the `users` table. Do not expose administrator registration publicly.

Use **Forgot password?** on the login screen to request a password reset link. The link is sent only if the account email exists; it expires after 60 minutes and can only be used once. Email delivery requires the barangay to configure a mail transport in its private `.env` file. The default Laravel `log` mailer records the reset message in `storage/logs/laravel.log` instead of delivering it, so configure SMTP before expecting users to receive reset emails.

The administrator account must use an email address that can receive messages for password recovery to work. A placeholder address such as `admin@humayingan.test` cannot receive reset emails.

## About Laravel

Laravel is a web application framework with expressive, elegant syntax. We believe development must be an enjoyable and creative experience to be truly fulfilling. Laravel takes the pain out of development by easing common tasks used in many web projects, such as:

- [Simple, fast routing engine](https://laravel.com/docs/routing).
- [Powerful dependency injection container](https://laravel.com/docs/container).
- Multiple back-ends for [session](https://laravel.com/docs/session) and [cache](https://laravel.com/docs/cache) storage.
- Expressive, intuitive [database ORM](https://laravel.com/docs/eloquent).
- Database agnostic [schema migrations](https://laravel.com/docs/migrations).
- [Robust background job processing](https://laravel.com/docs/queues).
- [Real-time event broadcasting](https://laravel.com/docs/broadcasting).

Laravel is accessible, powerful, and provides tools required for large, robust applications.

## Learning Laravel

Laravel has the most extensive and thorough [documentation](https://laravel.com/docs) and video tutorial library of all modern web application frameworks, making it a breeze to get started with the framework. You can also check out [Laravel Learn](https://laravel.com/learn), where you will be guided through building a modern Laravel application.

If you don't feel like reading, [Laracasts](https://laracasts.com) can help. Laracasts contains thousands of video tutorials on a range of topics including Laravel, modern PHP, unit testing, and JavaScript. Boost your skills by digging into our comprehensive video library.

## Laravel Sponsors

We would like to extend our thanks to the following sponsors for funding Laravel development. If you are interested in becoming a sponsor, please visit the [Laravel Partners program](https://partners.laravel.com).

### Premium Partners

- **[Vehikl](https://vehikl.com)**
- **[Tighten Co.](https://tighten.co)**
- **[Kirschbaum Development Group](https://kirschbaumdevelopment.com)**
- **[64 Robots](https://64robots.com)**
- **[Curotec](https://www.curotec.com/services/technologies/laravel)**
- **[DevSquad](https://devsquad.com/hire-laravel-developers)**
- **[Redberry](https://redberry.international/laravel-development)**
- **[Active Logic](https://activelogic.com)**

## Contributing

Thank you for considering contributing to the Laravel framework! The contribution guide can be found in the [Laravel documentation](https://laravel.com/docs/contributions).

## Code of Conduct

In order to ensure that the Laravel community is welcoming to all, please review and abide by the [Code of Conduct](https://laravel.com/docs/contributions#code-of-conduct).

## Security Vulnerabilities

If you discover a security vulnerability within Laravel, please send an e-mail to Taylor Otwell via [taylor@laravel.com](mailto:taylor@laravel.com). All security vulnerabilities will be promptly addressed.

## License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).
