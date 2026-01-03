function traefikToCommon(ingressRoute) {
    var common = { hosts: {}, name: "", namespace: "", tls: null };

    common.name = ingressRoute.metadata.name;
    common.namespace = ingressRoute.metadata.namespace;

    // Extract TLS configuration if present
    if (ingressRoute.spec.tls) {
        common.tls = {
            secretName: ingressRoute.spec.tls.secretName
        };
    }

    for (let r in ingressRoute.spec.routes) {
        let route = ingressRoute.spec.routes[r];
        let match = route.match;
        
        // Extract hosts - handle multiple hosts in single Host() expression
        let hostMatches = match.match(/Host\(\`([^)]+?)\`\)/);
        if (!hostMatches) continue;
        
        let hostsString = hostMatches[1];
        let hosts = hostsString.split('`, `').map(h => h.trim());
        
        // Extract path and path type
        let pathValue = "/"; // default path
        let pathType = "Prefix"; // default path type
        
        // Check for PathPrefix first
        let pathPrefixMatches = match.match(/PathPrefix\(\`([^`]+)\`\)/);
        if (pathPrefixMatches) {
            pathValue = pathPrefixMatches[1];
            pathType = "Prefix";
        } else {
            // Check for exact Path match
            let pathMatches = match.match(/Path\(\`([^`]+)\`\)/);
            if (pathMatches) {
                pathValue = pathMatches[1];
                pathType = "Exact";
            }
        }
        
        let service = route.services[0].name; // TODO Multiple services
        let port = route.services[0].port;
        
        // Process each host
        for (let host of hosts) {
            if (!common.hosts[host]) {
                common.hosts[host] = { paths: {} };
            }
            
            // Add path to this host with path type information
            common.hosts[host].paths[pathValue] = {
                service: service,
                port: port,
                pathType: pathType
            };
        }
    }

    // TODO ignore middleware and so on

    return common;
}

function ingressToCommon(ingress) {
    var common = { hosts: {}, name: "", namespace: "", tls: null };

    common.name = ingress.metadata.name;
    common.namespace = ingress.metadata.namespace;

    // Extract TLS configuration if present
    if (ingress.spec.tls && ingress.spec.tls.length > 0) {
        // For simplicity, take the first TLS entry
        common.tls = {
            secretName: ingress.spec.tls[0].secretName,
            hosts: ingress.spec.tls[0].hosts || []
        };
    }

    for (let r in ingress.spec.rules) {
        let rule = ingress.spec.rules[r];
        let host = rule.host;
        
        if (!common.hosts[host]) {
            common.hosts[host] = { paths: {} };
        }
        
        // Process all paths for this host
        for (let p in rule.http.paths) {
            let pathRule = rule.http.paths[p];
            let path = pathRule.path || "/";
            let service = pathRule.backend.service.name;
            let port = pathRule.backend.service.port.number || pathRule.backend.service.port.name;
            let pathType = pathRule.pathType || "Prefix"; // Default to Prefix if not specified
            
            common.hosts[host].paths[path] = {
                service: service,
                port: port,
                pathType: pathType
            };
        }
    }

    return common;
}

function commonToIngress(common) {
    var ingress = {
        apiVersion: "networking.k8s.io/v1",
        kind: "Ingress",
        metadata: {
            name: common.name,
            namespace: common.namespace,
        },
        spec: {
            rules: []
        }
    }

    for (let host in common.hosts) {
        let hostConfig = common.hosts[host];
        let paths = [];
        
        // Sort paths to put "/" at the end (most specific paths first)
        let sortedPaths = Object.keys(hostConfig.paths).sort((a, b) => {
            if (a === "/") return 1;
            if (b === "/") return -1;
            return b.length - a.length; // Longer paths first
        });
        
        for (let path of sortedPaths) {
            let pathConfig = hostConfig.paths[path];
            
            // Handle port as either number or string (name)
            let portConfig = {};
            if (typeof pathConfig.port === 'number') {
                portConfig.number = pathConfig.port;
            } else {
                portConfig.name = pathConfig.port;
            }
            paths.push({
                path: path,
                pathType: pathConfig.pathType || "Prefix",
                backend: {
                    service: {
                        name: pathConfig.service,
                        port: portConfig
                    }
                }
            });
        }

        ingress.spec.rules.push({
            host: host,
            http: {
                paths: paths
            }
        });
    }

    // Add TLS configuration if present
    if (common.tls && common.tls.secretName) {
        // Extract all hosts from the common format
        var allHosts = Object.keys(common.hosts);
        ingress.spec.tls = [{
            secretName: common.tls.secretName,
            hosts: common.tls.hosts && common.tls.hosts.length > 0 ? common.tls.hosts : allHosts
        }];
    }

    return ingress;
}

function commonToIngressRoute(common) {
    var ingressRoute = {
        apiVersion: "traefik.io/v1alpha1",
        kind: "IngressRoute",
        metadata: {
            name: common.name,
            namespace: common.namespace,
        },
        spec: {
            entryPoints: ["web", "websecure"],
            routes: []
        }
    }

    for (let host in common.hosts) {
        let hostConfig = common.hosts[host];
        
        for (let path in hostConfig.paths) {
            let pathConfig = hostConfig.paths[path];
            let match = `Host(\`${host}\`)`;
            
            // Add Path or PathPrefix based on pathType
            if (path !== "/") {
                if (pathConfig.pathType === "Exact") {
                    match += ` && Path(\`${path}\`)`;
                } else {
                    match += ` && PathPrefix(\`${path}\`)`;
                }
            }

            ingressRoute.spec.routes.push({
                kind: "Rule",
                match: match,
                services: [
                    {
                        name: pathConfig.service,
                        port: pathConfig.port,
                    }
                ]
            });
        }
    }

    // Add TLS configuration if present
    if (common.tls && common.tls.secretName) {
        ingressRoute.spec.tls = {
            secretName: common.tls.secretName
        };
    }

    return ingressRoute;
}

// Browser-specific code (jQuery)
if (typeof $ !== 'undefined') {
    $(document).ready(function () {
        // Function to show alerts
        function showAlert(message, type = 'success') {
            const alertHtml = `
                <div class="alert alert-${type} alert-dismissible fade show" role="alert">
                    <i class="bi bi-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i> ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>
            `;
            const $alert = $(alertHtml);
            $('#alert-container').append($alert);
            setTimeout(() => $alert.alert('close'), 3000);
        }

        // Function to apply syntax highlighting
        function applySyntaxHighlighting($textarea) {
            if (typeof hljs !== 'undefined') {
                const content = $textarea.val();
                try {
                    const highlighted = hljs.highlight(content, { language: 'yaml' }).value;
                    // Store cursor position
                    const cursorPos = $textarea[0].selectionStart;
                    // Temporarily show highlighting (for visual feedback only)
                    // Note: We keep the textarea as plaintext for editing
                    $textarea.data('highlighted', highlighted);
                } catch (e) {
                    console.warn('Syntax highlighting failed:', e);
                }
            }
        }

        // Apply initial syntax highlighting
        applySyntaxHighlighting($('#textarea-ingressroute'));
        applySyntaxHighlighting($('#textarea-ingress'));

        // Update syntax highlighting on input
        $('#textarea-ingressroute, #textarea-ingress').on('input', function() {
            applySyntaxHighlighting($(this));
        });

        // Convert IngressRoute to Ingress
        $("#btn-ingress").click(function () {
            try {
                var ingressRouteYaml = $("#textarea-ingressroute").val();
                if (!ingressRouteYaml.trim()) {
                    showAlert('Please enter IngressRoute YAML', 'danger');
                    return;
                }
                var ingressRouteJSON = YAML.parse(ingressRouteYaml);
                var common = traefikToCommon(ingressRouteJSON);
                var ingressJSON = commonToIngress(common);
                var ingressYaml = YAML.stringify(ingressJSON, 1000, 2);
                $("#textarea-ingress").val(ingressYaml);
                applySyntaxHighlighting($('#textarea-ingress'));
                showAlert('Successfully converted to Ingress!', 'success');
            } catch (error) {
                showAlert('Conversion failed: ' + error.message, 'danger');
                console.error('Conversion error:', error);
            }
        });

        // Convert Ingress to IngressRoute
        $("#btn-ingressroute").click(function () {
            try {
                var ingressYaml = $("#textarea-ingress").val();
                if (!ingressYaml.trim()) {
                    showAlert('Please enter Ingress YAML', 'danger');
                    return;
                }
                var ingressJSON = YAML.parse(ingressYaml);
                var common = ingressToCommon(ingressJSON);
                var ingressRouteJSON = commonToIngressRoute(common);
                var ingressRouteYaml = YAML.stringify(ingressRouteJSON, 1000, 2);
                $("#textarea-ingressroute").val(ingressRouteYaml);
                applySyntaxHighlighting($('#textarea-ingressroute'));
                showAlert('Successfully converted to IngressRoute!', 'success');
            } catch (error) {
                showAlert('Conversion failed: ' + error.message, 'danger');
                console.error('Conversion error:', error);
            }
        });

        // Copy to clipboard functionality
        $('.copy-btn').click(function() {
            const targetId = $(this).data('target');
            const $textarea = $('#' + targetId);
            const text = $textarea.val();

            // Use modern Clipboard API
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(() => {
                    showAlert('Copied to clipboard!', 'success');
                    // Visual feedback
                    const $btn = $(this);
                    const originalHtml = $btn.html();
                    $btn.html('<i class="bi bi-check"></i> Copied!');
                    setTimeout(() => $btn.html(originalHtml), 2000);
                }).catch(err => {
                    showAlert('Failed to copy: ' + err.message, 'danger');
                });
            } else {
                // Fallback for older browsers
                $textarea[0].select();
                $textarea[0].setSelectionRange(0, 99999); // For mobile devices
                try {
                    document.execCommand('copy');
                    showAlert('Copied to clipboard!', 'success');
                    const $btn = $(this);
                    const originalHtml = $btn.html();
                    $btn.html('<i class="bi bi-check"></i> Copied!');
                    setTimeout(() => $btn.html(originalHtml), 2000);
                } catch (err) {
                    showAlert('Failed to copy: ' + err.message, 'danger');
                }
            }
        });
    });
}

// Export functions for Node.js (command line usage)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        traefikToCommon,
        ingressToCommon,
        commonToIngress,
        commonToIngressRoute
    };
}