#!/usr/bin/awk -f

BEGIN {
    section = "header"
    buffer = ""
}

/^## Active Requests/ {
    section = "active_header"
    print buffer
    buffer = $0 "\n\n"
    next
}

/^### REQ-DEVOPS-ORCHESTRATOR-001:/ {
    section = "devops"
    devops = ""
}

/^### REQ-INFRA-DASHBOARD-001:/ {
    section = "infra"
    infra = ""
}

/^### REQ-PROACTIVE-001:/ {
    section = "proactive"
    proactive = ""
}

/^### REQ-/ && section != "header" && section != "active_header" && !/REQ-DEVOPS-ORCHESTRATOR-001/ && !/REQ-INFRA-DASHBOARD-001/ && !/REQ-PROACTIVE-001/ {
    if (section == "devops") {
        devops = buffer
        buffer = ""
    } else if (section == "infra") {
        infra = buffer
        buffer = ""
    } else if (section == "proactive") {
        proactive = buffer
        buffer = ""
    } else if (section == "features") {
        features = features buffer "---\n\n"
        buffer = ""
    }
    section = "features"
}

/^## Completed Requests/ {
    if (section == "devops") {
        devops = buffer
    } else if (section == "infra") {
        infra = buffer
    } else if (section == "proactive") {
        proactive = buffer
    } else if (section == "features") {
        features = features buffer
    }

    # Print in correct order
    printf "%s", devops
    printf "---\n\n"
    printf "%s", infra
    printf "---\n\n"
    printf "%s", proactive
    printf "---\n\n"
    printf "%s", features

    buffer = $0 "\n"
    section = "completed"
    next
}

{
    buffer = buffer $0 "\n"
}

END {
    print buffer
}
