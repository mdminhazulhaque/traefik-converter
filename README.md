# Traefik Converter

Convert objects between the types: IngressRoute (`traefik.io/v1alpha1`) and Ingress (`networking.k8s.io/v1`)

## TODO

- [ ] Traefik: Parse expressions with `Prefix`, `Header` etc
- [ ] Ingress: TLS Support
- [ ] Ingress: Port Name vs Number Support
- [ ] Traefik: Multiple Service Support
- [ ] Ingress: Add nginx/ALB/GCP Annotations
- [ ] Ingress: Always place `/` at the bottom of rules