function traefikToCommon(ingressRoute) {
    var common = { hosts: {}, name: "", namespace: "" };

    common.name = ingressRoute.metadata.name;
    common.namespace = ingressRoute.metadata.namespace;

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
    var common = { hosts: {}, name: "", namespace: "" };

    common.name = ingress.metadata.name;
    common.namespace = ingress.metadata.namespace;

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

    return ingressRoute;
}

// Browser-specific code (jQuery)
if (typeof $ !== 'undefined') {
    $(document).ready(function () {
        $("#btn-ingress").click(function () {
            var ingressRouteYaml = $("#textarea-ingressroute").val();
            var ingressRouteJSON = YAML.parse(ingressRouteYaml);
            var common = traefikToCommon(ingressRouteJSON);
            var ingressJSON = commonToIngress(common);
            var ingressYaml = YAML.stringify(ingressJSON, 1000, 2);
            $("#textarea-ingress").val(ingressYaml);
        });
        $("#btn-ingressroute").click(function () {
            var ingressYaml = $("#textarea-ingress").val();
            var ingressJSON = YAML.parse(ingressYaml);
            var common = ingressToCommon(ingressJSON);
            var ingressRouteJSON = commonToIngressRoute(common);
            var ingressRouteYaml = YAML.stringify(ingressRouteJSON, 1000, 2);
            $("#textarea-ingressroute").val(ingressRouteYaml);
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