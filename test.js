#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { traefikToCommon, ingressToCommon, commonToIngress, commonToIngressRoute } = require('./app.js');

// Helper function to read YAML file
function readYamlFile(filePath) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        return yaml.load(fileContent);
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error.message);
        process.exit(1);
    }
}

// Helper function to write YAML file
function writeYamlFile(filePath, data) {
    try {
        const yamlContent = yaml.dump(data, { indent: 2 });
        fs.writeFileSync(filePath, yamlContent, 'utf8');
        console.log(`Output written to: ${filePath}`);
    } catch (error) {
        console.error(`Error writing file ${filePath}:`, error.message);
        process.exit(1);
    }
}

// Main function
function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log(`
Usage: node test.js <command> <input-file> [output-file]

Commands:
  traefik-to-ingress    Convert Traefik IngressRoute to Kubernetes Ingress
  ingress-to-traefik    Convert Kubernetes Ingress to Traefik IngressRoute
  traefik-to-common     Convert Traefik IngressRoute to common format (JSON)
  ingress-to-common     Convert Kubernetes Ingress to common format (JSON)
  common-to-traefik     Convert common format to Traefik IngressRoute
  common-to-ingress     Convert common format to Kubernetes Ingress

Examples:
  node test.js traefik-to-ingress test/ingressroute.yaml output-ingress.yaml
  node test.js ingress-to-traefik test/ingress.yaml output-ingressroute.yaml
  node test.js traefik-to-common test/ingressroute.yaml
        `);
        process.exit(1);
    }

    const command = args[0];
    const inputFile = args[1];
    const outputFile = args[2];

    // Check if input file exists
    if (!fs.existsSync(inputFile)) {
        console.error(`Input file not found: ${inputFile}`);
        process.exit(1);
    }

    let inputData, result;

    try {
        switch (command) {
            case 'traefik-to-ingress':
                inputData = readYamlFile(inputFile);
                const common1 = traefikToCommon(inputData);
                result = commonToIngress(common1);
                if (outputFile) {
                    writeYamlFile(outputFile, result);
                } else {
                    console.log(yaml.dump(result, { indent: 2 }));
                }
                break;

            case 'ingress-to-traefik':
                inputData = readYamlFile(inputFile);
                const common2 = ingressToCommon(inputData);
                result = commonToIngressRoute(common2);
                if (outputFile) {
                    writeYamlFile(outputFile, result);
                } else {
                    console.log(yaml.dump(result, { indent: 2 }));
                }
                break;

            case 'traefik-to-common':
                inputData = readYamlFile(inputFile);
                result = traefikToCommon(inputData);
                if (outputFile) {
                    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
                    console.log(`Common format written to: ${outputFile}`);
                } else {
                    console.log(JSON.stringify(result, null, 2));
                }
                break;

            case 'ingress-to-common':
                inputData = readYamlFile(inputFile);
                result = ingressToCommon(inputData);
                if (outputFile) {
                    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
                    console.log(`Common format written to: ${outputFile}`);
                } else {
                    console.log(JSON.stringify(result, null, 2));
                }
                break;

            case 'common-to-traefik':
                const commonData1 = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
                result = commonToIngressRoute(commonData1);
                if (outputFile) {
                    writeYamlFile(outputFile, result);
                } else {
                    console.log(yaml.dump(result, { indent: 2 }));
                }
                break;

            case 'common-to-ingress':
                const commonData2 = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
                result = commonToIngress(commonData2);
                if (outputFile) {
                    writeYamlFile(outputFile, result);
                } else {
                    console.log(yaml.dump(result, { indent: 2 }));
                }
                break;

            default:
                console.error(`Unknown command: ${command}`);
                process.exit(1);
        }
    } catch (error) {
        console.error(`Error processing command '${command}':`, error.message);
        process.exit(1);
    }
}

// Run the main function
main();
