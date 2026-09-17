/*
 * Jenkins declarative pipeline for the Playwright test framework.
 *
 * Prerequisites on the Jenkins controller:
 *  - NodeJS plugin with a tool installation named "NodeJS" (Node 20 LTS recommended)
 *  - JUnit plugin, HTML Publisher plugin, Credentials Binding plugin
 *  - A "Username with password" credential with id "demoblaze-test-user"
 *    (username -> TEST_USERNAME, password -> TEST_PASSWORD). Secrets never live in the repo.
 *
 * Sharding: set SHARDS > 1 to fan the UI suites out to that many agents. Every shard produces
 * a blob report; the reports are merged into a single HTML/JUnit report at the end.
 */
pipeline {
    agent any

    tools {
        nodejs 'NodeJS'
    }

    parameters {
        choice(name: 'TEST_ENV', choices: ['dev', 'staging', 'prod'], description: 'Target environment (environments/.env.<env>)')
        choice(name: 'BROWSERS', choices: ['all', 'chromium', 'firefox', 'webkit'], description: 'Browser project(s) to run')
        booleanParam(name: 'RUN_API_TESTS', defaultValue: true, description: 'Also run the browser-less "api" project and the "framework" self-tests')
        string(name: 'TAGS', defaultValue: '', description: 'Regex for --grep, e.g. @smoke|@regression (empty = all tests)')
        string(name: 'EXCLUDE_TAGS', defaultValue: '@wip|@flaky', description: 'Regex for --grep-invert')
        string(name: 'SHARDS', defaultValue: '1', description: 'Number of parallel shards/agents for UI suites (1 = no sharding)')
        string(name: 'WORKERS', defaultValue: '50%', description: 'Playwright workers per shard (number or percentage)')
    }

    environment {
        CI = 'true'
        NO_COLOR = '1'
        HUSKY = '0'
        LOG_FORMAT = 'json'
        TEST_ENV = "${params.TEST_ENV}"
        TEST_TAGS = "${params.TAGS}"
        EXCLUDE_TAGS = "${params.EXCLUDE_TAGS}"
        WORKERS = "${params.WORKERS}"
        GIT_COMMIT_SHORT = "${env.GIT_COMMIT ? env.GIT_COMMIT.take(7) : 'local'}"
    }

    options {
        timeout(time: 90, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '30', artifactNumToKeepStr: '10'))
        timestamps()
        disableConcurrentBuilds()
    }

    stages {
        stage('Install') {
            steps {
                script {
                    run('npm ci')
                    run('npx playwright install --with-deps')
                }
            }
        }

        stage('Quality gate') {
            parallel {
                stage('Typecheck') {
                    steps { script { run('npm run typecheck') } }
                }
                stage('Lint') {
                    steps { script { run('npm run lint') } }
                }
                stage('Format') {
                    steps { script { run('npm run format:check') } }
                }
            }
        }

        stage('Test') {
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'demoblaze-test-user',
                    usernameVariable: 'TEST_USERNAME',
                    passwordVariable: 'TEST_PASSWORD'
                )]) {
                    script {
                        int shards = params.SHARDS.toInteger()
                        String projects = projectArgs()

                        if (shards <= 1) {
                            catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                                run("npx playwright test ${projects}")
                            }
                        } else {
                            runSharded(shards, projects)
                        }
                    }
                }
            }
        }
    }

    post {
        always {
            junit allowEmptyResults: true, testResults: 'test-results/junit.xml'
            publishHTML(target: [
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'playwright-report',
                reportFiles: 'index.html',
                reportName: 'Playwright Report',
                reportTitles: "E2E ${params.TEST_ENV} #${env.BUILD_NUMBER}"
            ])
            // Traces, videos and screenshots are only kept for failures (preserveOutput: failures-only).
            archiveArtifacts artifacts: 'playwright-report/**/*, test-results/**/*', allowEmptyArchive: true, fingerprint: false
        }
        failure {
            echo "Build failed - inspect the Playwright Report (traces are attached to failed tests)."
            // Hook notifications here, e.g. slackSend(channel: '#qa-alerts', message: "...").
        }
    }
}

/** Runs a shell command on Unix or Windows agents. */
def run(String command) {
    if (isUnix()) {
        sh command
    } else {
        bat command
    }
}

/** Translates pipeline parameters into `--project` flags. */
String projectArgs() {
    List<String> projects = params.BROWSERS == 'all' ? ['chromium', 'firefox', 'webkit'] : [params.BROWSERS]
    if (params.RUN_API_TESTS) {
        projects << 'api'
        projects << 'framework'
    }
    return projects.collect { "--project=${it}" }.join(' ')
}

/**
 * Fans the run out to N agents. Each shard installs its own dependencies, runs its slice with
 * the blob reporter (enabled automatically when CI=true) and stashes the blob for merging.
 */
def runSharded(int shards, String projects) {
    Map<String, Closure> branches = [:]
    for (int i = 1; i <= shards; i++) {
        int shardIndex = i
        branches["shard ${shardIndex}/${shards}"] = {
            node {
                checkout scm
                withNode {
                    run('npm ci')
                    run('npx playwright install --with-deps')
                    catchError(buildResult: 'FAILURE', stageResult: 'FAILURE') {
                        run("npx playwright test ${projects} --shard=${shardIndex}/${shards}")
                    }
                    stash name: "blob-${shardIndex}", includes: 'blob-report/**', allowEmpty: true
                }
            }
        }
    }
    parallel branches

    // Merge every shard's blob report into one HTML + JUnit report on the primary agent.
    for (int i = 1; i <= shards; i++) {
        unstash "blob-${i}"
    }
    run('npm run report:merge')
}

/** Makes the configured NodeJS tool available on a dynamically allocated agent. */
def withNode(Closure body) {
    String nodeHome = tool name: 'NodeJS', type: 'nodejs'
    String binDir = isUnix() ? "${nodeHome}/bin" : nodeHome
    withEnv(["PATH+NODE=${binDir}"]) {
        body()
    }
}
