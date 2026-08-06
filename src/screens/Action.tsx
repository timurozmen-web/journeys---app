import { useParams } from 'react-router-dom';
export function Action() {
  const { kind } = useParams();
  return <div className="head"><div className="h1" style={{ textTransform: 'capitalize' }}>{kind}</div></div>;
}
