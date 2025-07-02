# OneKey KYC API Documentation

This directory contains the complete documentation for the OneKey KYC API built with [Mintlify](https://mintlify.com), a modern documentation platform designed for developer-first companies.

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ installed
- npm or yarn package manager
- A Mintlify account (for deployment)

### Local Development

1. **Install Mintlify CLI**
   ```bash
   npm i -g mintlify
   ```

2. **Start the development server**
   ```bash
   cd docs
   mintlify dev
   ```

3. **Open your browser**
   ```
   http://localhost:3000
   ```

The documentation will automatically reload when you make changes to any `.mdx` files.

## 📁 Documentation Structure

```
docs/
├── mint.json                          # Mintlify configuration
├── introduction.mdx                   # Main landing page
├── quickstart.mdx                     # Getting started guide
├── authentication.mdx                 # Authentication guide
├── concepts/                          # Core concepts
│   ├── kyc-flow.mdx                  # KYC verification process
│   ├── encryption.mdx                # Client-side encryption
│   ├── attestations.mdx              # Blockchain attestations
│   └── privacy.mdx                   # Privacy architecture
├── guides/                           # Implementation guides
│   ├── getting-started.mdx           # Setup walkthrough
│   ├── kyc-integration.mdx           # KYC implementation
│   ├── web3-auth.mdx                 # Web3 authentication
│   ├── encryption-setup.mdx          # Encryption setup
│   ├── attestation-creation.mdx      # Creating attestations
│   └── error-handling.mdx            # Error handling patterns
├── api-reference/                    # API documentation
│   ├── introduction.mdx              # API overview
│   ├── authentication/               # Auth endpoints
│   ├── kyc/                         # KYC endpoints
│   ├── encryption/                  # Encryption endpoints
│   ├── attestations/                # Attestation endpoints
│   └── system/                      # System endpoints
├── sdks/                            # SDK documentation
│   ├── javascript.mdx               # JavaScript SDK
│   ├── python.mdx                   # Python SDK
│   └── react.mdx                    # React SDK
└── resources/                       # Additional resources
    ├── errors.mdx                   # Error codes
    ├── webhooks.mdx                 # Webhook reference
    ├── rate-limits.mdx              # Rate limiting
    └── changelog.mdx                # Version history
```

## 🛠️ Configuration

### `mint.json`

The main configuration file that defines:

- **Navigation structure**: Page hierarchy and grouping
- **Branding**: Colors, logos, and styling
- **API settings**: Base URLs and authentication
- **Integrations**: Analytics, feedback, and support

### Key Features Configured

- **Multi-tab navigation**: API Reference, SDKs, Guides
- **OpenAPI integration**: Automatic API documentation
- **Custom branding**: OneKey colors and styling
- **Social links**: GitHub, Twitter, LinkedIn
- **Support integration**: Help desk and community links

## ✍️ Writing Documentation

### MDX Format

All documentation files use MDX (Markdown + JSX), which allows you to:

- Write standard Markdown content
- Use React components for interactive elements
- Include code snippets with syntax highlighting
- Add Mintlify-specific components

### Mintlify Components

#### Cards and Layouts
```mdx
<CardGroup cols={2}>
  <Card title="Feature 1" icon="star" href="/path">
    Description of feature 1
  </Card>
  <Card title="Feature 2" icon="heart" href="/path">
    Description of feature 2
  </Card>
</CardGroup>
```

#### Code Examples
```mdx
<CodeGroup>

```javascript JavaScript
const response = await fetch('/api/endpoint');
```

```python Python
response = requests.get('/api/endpoint')
```

</CodeGroup>
```

#### API Documentation
```mdx
<ParamField body="parameter" type="string" required>
  Description of the parameter
</ParamField>

<ResponseField name="field" type="object">
  Description of the response field
</ResponseField>
```

#### Interactive Elements
```mdx
<Tabs>
  <Tab title="Option 1">
    Content for option 1
  </Tab>
  <Tab title="Option 2">
    Content for option 2
  </Tab>
</Tabs>

<AccordionGroup>
  <Accordion title="Section 1">
    Collapsible content
  </Accordion>
</AccordionGroup>
```

#### Callouts
```mdx
<Note>
Important information for developers
</Note>

<Warning>
Critical warnings and gotchas
</Warning>

<Tip>
Helpful tips and best practices
</Tip>
```

## 🚀 Deployment

### Mintlify Cloud (Recommended)

1. **Connect your repository**
   - Sign up at [mintlify.com](https://mintlify.com)
   - Connect your GitHub repository
   - Set the docs directory as the source

2. **Configure deployment**
   - Set build command: `mintlify build`
   - Set output directory: `_site`
   - Configure custom domain (optional)

3. **Automatic deployment**
   - Push changes to main branch
   - Documentation automatically rebuilds and deploys

### Self-Hosted

1. **Build the documentation**
   ```bash
   mintlify build
   ```

2. **Deploy the `_site` directory**
   ```bash
   # Example: Deploy to Netlify
   netlify deploy --prod --dir=_site

   # Example: Deploy to Vercel
   vercel --prod _site

   # Example: Deploy to AWS S3
   aws s3 sync _site s3://your-bucket-name
   ```

## 🔧 Development Workflow

### Adding New Pages

1. **Create the MDX file**
   ```bash
   touch docs/new-section/new-page.mdx
   ```

2. **Add frontmatter**
   ```mdx
   ---
   title: "Page Title"
   description: "Page description for SEO"
   ---
   ```

3. **Update navigation**
   Edit `mint.json` to include the new page in the navigation structure.

### API Reference Pages

For API endpoints, use this template:

```mdx
---
title: "Endpoint Name"
api: "POST https://api.onekey.so/v1/endpoint"
description: "Endpoint description"
---

## Overview
Brief description of what the endpoint does.

## Authentication
<ParamField header="Authorization" type="string" required>
  Bearer JWT token
</ParamField>

## Request Body
<ParamField body="param" type="string" required>
  Parameter description
</ParamField>

## Response
<ResponseField name="field" type="string">
  Response field description
</ResponseField>

## Example
<RequestExample>
```bash cURL
curl -X POST https://api.onekey.so/v1/endpoint
```
</RequestExample>

<ResponseExample>
```json Response
{
  "success": true,
  "data": {}
}
```
</ResponseExample>
```

### Best Practices

1. **Consistent naming**: Use kebab-case for filenames
2. **Clear hierarchy**: Organize related content in folders
3. **SEO optimization**: Include meta descriptions
4. **Code examples**: Provide working code in multiple languages
5. **Cross-references**: Link related pages and concepts
6. **Version control**: Keep documentation in sync with API changes

## 📊 Analytics & Feedback

### Configured Integrations

- **Google Analytics**: Track page views and user behavior
- **Intercom**: Embedded chat support
- **GitHub Issues**: Link to bug reports and feature requests
- **User feedback**: Built-in feedback collection

### Monitoring

- **Page performance**: Load times and user engagement
- **Search queries**: Most searched terms and failed searches
- **User flows**: How users navigate through documentation
- **Conversion**: From docs to API usage

## 🤝 Contributing

### Documentation Guidelines

1. **Clarity first**: Write for developers of all experience levels
2. **Working examples**: All code examples should be functional
3. **Up-to-date**: Keep content synchronized with API changes
4. **Visual aids**: Use diagrams and screenshots where helpful
5. **Accessibility**: Follow web accessibility guidelines

### Review Process

1. **Create feature branch**: `docs/feature-name`
2. **Make changes**: Edit or add MDX files
3. **Test locally**: Verify with `mintlify dev`
4. **Submit PR**: Include screenshots of changes
5. **Review cycle**: Technical and editorial review
6. **Deploy**: Automatic deployment after merge

## 📞 Support

### Getting Help

- **Mintlify Docs**: [mintlify.com/docs](https://mintlify.com/docs)
- **Community**: [mintlify.com/community](https://mintlify.com/community)
- **Support**: support@mintlify.com

### OneKey Documentation Team

- **Technical Writing**: docs@onekey.so
- **API Changes**: engineering@onekey.so
- **Design Feedback**: design@onekey.so

---

## 🏗️ Built With

- **[Mintlify](https://mintlify.com)**: Documentation platform
- **[MDX](https://mdxjs.com)**: Markdown + JSX
- **[React](https://reactjs.org)**: Component framework
- **[Tailwind CSS](https://tailwindcss.com)**: Styling framework

Ready to contribute? Start by running `mintlify dev` and exploring the documentation structure! 