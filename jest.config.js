module.exports = {
    globals: {
        "ts-jest": {
            tsConfig: "tsconfig.json"
        }
    },
    moduleFileExtensions: [
        "ts",
        "js"
    ],
    transform: {
        "^.+\\.(ts|tsx)$": "ts-jest"
    },
    testMatch: [
        // "**/test/**/*.test.(ts|js)"
        "**/test/**/*.test.ts"
    ],
    testEnvironment: "node",
    coveragePathIgnorePatterns: [
        "<rootDir>/coverage/",
        "<rootDir>/demo/",
        "<rootDir>/dist/",
        "<rootDir>/node_modules/",
        "<rootDir>/out/",
        "<rootDir>/src/demo/",
        "<rootDir>/src/types/",
        "<rootDir>/src/devutils/",
        "<rootDir>/src/lib/vendor/",
    ]
};
