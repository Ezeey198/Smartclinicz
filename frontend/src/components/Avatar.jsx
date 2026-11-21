// The person's picture in a circle (their initials when there is no picture).
export default function Avatar({ user, size = 38 }) {
  const initials = (user.full_name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return user.avatar
    ? <img className="avatar" src={user.avatar} alt="" style={{ width: size, height: size }} />
    : <span className="avatar init" style={{ width: size, height: size, fontSize: size * 0.4 }}>{initials}</span>;
}
