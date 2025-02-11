// Add specific error handling for common charger connection issues
const handleChargerError = (error) => {
    const errorMap = {
        'ECONNREFUSED': {
            message: 'Connection refused - check if charger can reach server IP/port',
            solution: 'Verify firewall rules and network connectivity'
        },
        'CERT_INVALID': {
            message: 'SSL certificate not trusted by charger',
            solution: 'Install server certificate on charger or use proper SSL cert'
        },
        'PROTOCOL_MISMATCH': {
            message: 'OCPP protocol version mismatch',
            solution: 'Ensure charger and server use same OCPP version'
        }
    };

    const knownError = errorMap[error.code];
    if (knownError) {
        console.error(`Charger Error: ${knownError.message}`);
        console.log(`Solution: ${knownError.solution}`);
    }
    return knownError || error;
}; 