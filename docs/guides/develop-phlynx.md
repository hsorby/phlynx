# Developer Guide

This guide details the setup process for developers contributing to PhLynx or building the application from source.

## Prerequisites

Ensure your development environment meets the following requirements:
* **Node.js:** v20 or later.
* **Package Manager:** `npm` or `yarn`.

## Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/physiomelinks/phlynx.git](https://github.com/physiomelinks/phlynx.git)
    cd phlynx
    ```

2.  **Install dependencies:**
    ```bash
    yarn install
    ```

## Development Server

To launch the application in development mode with hot-reloading enabled:

```bash
yarn dev
```

The application will be accessible at http://localhost:5173 (or the port specified in your terminal).