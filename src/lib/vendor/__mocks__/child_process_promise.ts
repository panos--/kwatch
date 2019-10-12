import _ from "lodash";

const cpp = jest.genMockFromModule("./child_process_promise");

const outputs: {[k: string]: {[k: string]: {[k: string]: string}}} = {
    "kubectl": {
        "-n default get pods test-pod -o yaml": {
            "out":
`apiVersion: v1
kind: Pod
metadata:
  name: test-pod
  namespace: default
spec:
  containers:
    image: test-container:latest
`,
            "err": "test-pod failure"
        },
        "-n default describe pods test-pod": {
            "out":
`Name:           test-pod
Namespace:      default
Containers:
  exim-smarthost:
    Image:          test-container:latest
`,
            "err": "test-pod failure"
        },
        "-n default delete pods test-pod": {
            "out": "pod \"test-pod\" deleted",
            "err": "delete test-pod failure"
        },
        "-n default delete --force --grace-period=0 pods test-pod": {
            "out": "pod \"test-pod\" force deleted",
            "err": "force delete test-pod failure"
        },
        "-n default get pods -o wide": {
            "out":
`NAME    READY   STATUS    RESTARTS   AGE   IP              NODE    NOMINATED NODE
pod-0   2/2     Running   0          41d   10.244.9.186    node1   <none>
pod-1   1/1     Running   0          35d   10.244.6.68     node2   <none>
pod-2   1/1     Running   0          35d   10.244.10.230   node3   <none>
`,
            "err": "get pods failure"
        },
        "-n empty-ns get pods -o wide": {
            "out": "No resources found in empty-ns namespace.\n",
            "err": "get pods failure"
        },
    }
};

async function execFile(file: string, args: readonly string[]): Promise<any> {
    const argsString = args.join(" ");
    if (outputs.hasOwnProperty(file) && outputs[file].hasOwnProperty(argsString)) {
        const outputDef = outputs[file][argsString];
        if (execFile.__mockFail) {
            if (!outputDef.hasOwnProperty("err")) {
                throw new Error("mock setup error: no failure output defined");
            }
            throw new Error(outputDef.err);
        }
        if (!outputDef.hasOwnProperty("out")) {
            throw new Error("mock setup error: no output defined");
        }
        return { stdout: outputDef.out, stderr: Buffer.from("") };
    }

    throw new Error(`unmocked call to execFile: ${file} ${args.join(" ")}`);
}
execFile.__mockFail = false;

(cpp as any).execFile = execFile;

module.exports = cpp;
