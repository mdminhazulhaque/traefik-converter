function traefikToCommon(ingressRoute) {
    var common = { hosts: {}, name: "", namespace: "" };

    common.name = ingressRoute.metadata.name;
    common.namespace = ingressRoute.metadata.namespace;

    for (let r in ingressRoute.spec.routes) {
        let route = ingressRoute.spec.routes[r];
        let match = route.match;
        let host = match.match(/Host\(\`(.*)\`\)/)[1]; // TODO Prefix, Header etc
        let service = route.services[0].name; // TODO Multiple services
        let port = route.services[0].port;
        common.hosts[host] = { service: service, port: port };
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
        let service = rule.http.paths[0].backend.service.name; // TODO multiple routes
        let port = rule.http.paths[0].backend.service.port.number;
        common.hosts[host] = { service: service, port: port };
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
        let service = common.hosts[host];

        ingress.spec.rules.push({
            host: host,
            http: {
                paths: [
                    {
                        path: "/", // TODO Put / at bottom
                        pathType: "Prefix",
                        backend: {
                            service: {
                                name: service.service,
                                port: {
                                    number: service.port
                                }
                            }
                        }
                    }
                ]
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
        let service = common.hosts[host];

        ingressRoute.spec.routes.push({
            kind: "Rule",
            match: "Host(`" + host + "`)",
            services: [
                {
                    name: service.service,
                    port: service.port,
                }
            ]
        });
    }

    return ingressRoute;
}

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