package auth

type Role string

const (
	RoleAdmin Role = "admin"
	RoleUser  Role = "user"
)

type Permissions struct {
	CanManageUsers   bool `json:"canManageUsers"`
	CanManageDevices bool `json:"canManageDevices"`
}

func ParseRole(value string) Role {
	role := Role(value)
	if !role.Valid() {
		return Role("")
	}

	return role
}

func (r Role) Valid() bool {
	return r == RoleAdmin || r == RoleUser
}

func (r Role) CanManageUsers() bool {
	return r == RoleAdmin
}

func (r Role) CanManageDevices() bool {
	return r == RoleAdmin
}

func PermissionsForRole(role Role) Permissions {
	return Permissions{
		CanManageUsers:   role.CanManageUsers(),
		CanManageDevices: role.CanManageDevices(),
	}
}

