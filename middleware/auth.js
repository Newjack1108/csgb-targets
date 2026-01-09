/**
 * Authentication Middleware
 */

/**
 * Require authentication - user must be logged in
 */
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    res.redirect('/login');
}

/**
 * Require specific role(s)
 * @param {String|Array} allowedRoles - Role(s) that can access
 */
function requireRole(allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    return (req, res, next) => {
        if (!req.session || !req.session.userId) {
            return res.redirect('/login');
        }
        
        if (!req.session.userRole) {
            return res.status(403).send('Access denied');
        }
        
        if (roles.includes(req.session.userRole)) {
            return next();
        }
        
        res.status(403).send('Access denied');
    };
}

/**
 * Make user data available to all views
 */
function userLocals(req, res, next) {
    if (req.session && req.session.userId) {
        res.locals.user = {
            id: req.session.userId,
            name: req.session.userName,
            role: req.session.userRole,
            email: req.session.userEmail
        };
    } else {
        res.locals.user = null;
    }
    next();
}

module.exports = {
    requireAuth,
    requireRole,
    userLocals
};
