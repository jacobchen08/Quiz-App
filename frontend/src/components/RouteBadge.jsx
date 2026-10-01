// A coloured line badge, like the route bullets on a departure board.
// Decorative: the category name is always written out next to it.
function RouteBadge({ code, line, size = 'md' }) {
  return (
    <span key={code} className={`route route-${line} route-${size}`} aria-hidden="true">
      {code}
    </span>
  );
}

export default RouteBadge;
