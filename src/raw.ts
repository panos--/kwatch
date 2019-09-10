import * as k8s from "@kubernetes/client-node";
import * as request from "request";
import * as rp from "request-promise-native";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

async function main() {
    let opts: request.Options = {
        url: `${kc.getCurrentCluster().server}/${process.argv[2]}`,
        json: false,
    };
    kc.applyToRequest(opts);
    // console.log("opts:", opts);

    let body = await rp.get(opts);
    // console.log(body);
    process.stdout.write(body);
}

main();
