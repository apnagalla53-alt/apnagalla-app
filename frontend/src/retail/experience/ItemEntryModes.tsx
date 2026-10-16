import { NavLink } from 'react-router-dom';
import { ui } from '../../i18n';
export default function ItemEntryModes(){return <nav className="r-item-entry-modes" aria-label="Item entry mode"><NavLink to="/retail/items/add" className="r-btn">{ui('Add One Item')}</NavLink><NavLink to="/retail/items/bulk" className="r-btn">{ui('Add Many Items')}</NavLink></nav>;}

