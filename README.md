# Traefik Converter

Convert objects between the types: IngressRoute (`traefik.io/v1alpha1`) and Ingress (`networking.k8s.io/v1`)

## Features

### ✅ Supported Features

#### Host Configuration
- **Single Host**: `Host(\`example.com\`)` → Single Ingress rule
- **Multiple Hosts**: `Host(\`app1.com\`, \`app2.com\`, \`app3.com\`)` → Separate Ingress rules for each host

#### Path Matching
- **Path Prefix**: `PathPrefix(\`/api\`)` → `pathType: Prefix` in Ingress
- **Exact Path**: `Path(\`/health\`)` → `pathType: Exact` in Ingress
- **Root Path**: No path specified defaults to `/` with `pathType: Prefix`

#### Service Configuration
- **Port Names**: String ports like `"http"`, `"https"` → `port.name` in Ingress
- **Port Numbers**: Numeric ports like `80`, `443`, `8080` → `port.number` in Ingress
- **Service Mapping**: Traefik services map directly to Ingress backend services

#### TLS Configuration
- **TLS Secrets**: Certificate configuration via `spec.tls.secretName` in IngressRoute
- **Ingress TLS**: Bidirectional conversion of TLS secrets between IngressRoute and Ingress
- **Host Mapping**: Automatic host association for TLS certificates

#### Bidirectional Conversion
- **Traefik → Ingress**: Convert IngressRoute to Kubernetes Ingress
- **Ingress → Traefik**: Convert Kubernetes Ingress to Traefik IngressRoute
- **Intermediate Format**: Common JSON structure for debugging and custom processing

### ❌ Not Supported (Yet)

#### Traefik Features
- **Middlewares**: Authentication, rate limiting, headers modification
- **Multiple Services**: Load balancing between multiple backend services
- **Advanced Matchers**: `Header()`, `Method()`, `Query()`, `ClientIP()` expressions
- **Priority/Weight**: Route prioritization and traffic splitting

#### Ingress Features
- **Annotations**: nginx, ALB, GCP-specific annotations
- **Default Backend**: Fallback service configuration
- **Ingress Classes**: Specific ingress controller targeting

## Usage

### Web Interface

**Simply open `index.html` in your browser - no build step required!**

The web interface is a single HTML file with a beautiful, modern UI built using Tailwind CSS.

#### Features
- **🎨 Modern UI**: Beautiful shadcn/ui-inspired interface with Tailwind CSS
- **✨ YAML Syntax Highlighting**: Real-time syntax highlighting with highlight.js
- **📋 Copy to Clipboard**: One-click copy buttons for both IngressRoute and Ingress
- **⚡ Real-time Conversion**: Instant bidirectional conversion between formats
- **🎯 Error Handling**: Clear error messages with helpful notifications
- **📱 Responsive Design**: Mobile-friendly interface that works on all devices
- **🌐 Client-Side Only**: Pure client-side conversion - works offline, no backend required
- **🚀 Zero Dependencies**: No npm install, no build step - just open and use!

#### Web Interface Capabilities
1. **Bidirectional Conversion**: Convert between IngressRoute and Ingress formats with a single click
2. **Live Editing**: Edit YAML directly in the browser with real-time syntax highlighting
3. **Instant Feedback**: Real-time error notifications and validation
4. **Copy & Paste**: Easily copy converted YAML to your clipboard
5. **No Setup Required**: Just open index.html in any modern browser

### Command Line Interface

#### Installation
```bash
npm install
```

#### Available Commands
```bash
# Convert Traefik IngressRoute to Kubernetes Ingress
node test.js traefik-to-ingress input.yaml [output.yaml]

# Convert Kubernetes Ingress to Traefik IngressRoute
node test.js ingress-to-traefik input.yaml [output.yaml]

# View intermediate common format (useful for debugging)
node test.js traefik-to-common input.yaml
node test.js ingress-to-common input.yaml

# Convert from common format
node test.js common-to-traefik common.json [output.yaml]
node test.js common-to-ingress common.json [output.yaml]
```

#### Examples
```bash
# Convert and save to file
node test.js traefik-to-ingress my-ingressroute.yaml my-ingress.yaml

# View output in terminal
node test.js traefik-to-ingress my-ingressroute.yaml

# Use npm scripts
npm run traefik-to-ingress my-ingressroute.yaml
npm run ingress-to-traefik my-ingress.yaml
```

## Example Conversion

### Input (Traefik IngressRoute)
```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: my-app
  namespace: default
spec:
  entryPoints:
  - web
  - websecure
  routes:
  - kind: Rule
    match: Host(`app1.example.com`, `app2.example.com`)
    services:
    - name: web-service
      port: http
  - kind: Rule
    match: Host(`api.example.com`) && PathPrefix(`/v1`)
    services:
    - name: api-service
      port: 8080
  - kind: Rule
    match: Host(`api.example.com`) && Path(`/health`)
    services:
    - name: health-service
      port: http
```

### Output (Kubernetes Ingress)
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app
  namespace: default
spec:
  rules:
  - host: app1.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-service
            port:
              name: http
  - host: app2.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-service
            port:
              name: http
  - host: api.example.com
    http:
      paths:
      - path: /v1
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 8080
      - path: /health
        pathType: Exact
        backend:
          service:
            name: health-service
            port:
              name: http
```

### TLS Example

#### Input (Traefik IngressRoute with TLS)
```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: secure-app
  namespace: default
spec:
  entryPoints:
  - web
  - websecure
  routes:
  - kind: Rule
    match: Host(`secure.example.com`)
    services:
    - name: secure-service
      port: 80
  - kind: Rule
    match: Host(`api.secure.example.com`) && PathPrefix(`/v1`)
    services:
    - name: api-service
      port: 8080
  tls:
    secretName: my-tls-secret
```

#### Output (Kubernetes Ingress with TLS)
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: secure-app
  namespace: default
spec:
  rules:
  - host: secure.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: secure-service
            port:
              number: 80
  - host: api.secure.example.com
    http:
      paths:
      - path: /v1
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 8080
  tls:
  - secretName: my-tls-secret
    hosts:
    - secure.example.com
    - api.secure.example.com
```

## Technology Stack

### Web Interface
- **Styling**: Tailwind CSS 3 (via CDN)
- **UI Design**: shadcn/ui-inspired components
- **Icons**: Heroicons (SVG)
- **Syntax Highlighting**: highlight.js
- **YAML Parser**: js-yaml (via CDN)

### Browser Requirements

The web interface works with modern browsers that support:
- ES6+ JavaScript features
- React 18
- Clipboard API (for copy functionality)
- CSS Grid and Flexbox

**Tested Browsers:**
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

**Note:** The web interface is 100% client-side - no server or backend required. All conversion happens locally in your browser.

## Troubleshooting

### Common Issues

**Conversion fails with "undefined" errors:**
- Ensure your YAML is properly formatted
- Check that required fields (apiVersion, kind, metadata, spec) are present
- Verify that host expressions use backticks: `` Host(`example.com`) ``

**Copy to clipboard not working:**
- Modern browsers require HTTPS or localhost for clipboard access
- On older browsers, the fallback uses `document.execCommand`
- Check browser console for specific clipboard errors

**YAML not displaying correctly:**
- Clear browser cache and reload
- Ensure JavaScript is enabled
- Check browser console for CDN loading errors

## Contributing

Feel free to contribute by:
- Adding support for more Traefik matchers
- Implementing middleware conversion
- Adding annotation support for different Ingress controllers
- Improving error handling and validation
- Enhancing the UI/UX
- Adding tests

## License

ISC