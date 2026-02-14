
import React, { useState, useEffect } from 'react';
import { User, Group } from '../types';
import { db } from '../firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot, collection } from 'firebase/firestore';

interface GroupProfileScreenProps {
  group: Group;
  currentUser: User;
  onBack: () => void;
  onCloseChat: () => void;
}

export const GroupProfileScreen: React.FC<GroupProfileScreenProps> = ({ group, currentUser, onBack, onCloseChat }) => {
  const [members, setMembers] = useState<User[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(group.name);
  const [showAddUser, setShowAddUser] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Defensive checks for arrays
  const groupAdmins = group.admins || [];
  const groupMembers = group.members || [];
  const isAdmin = groupAdmins.includes(currentUser.phone);
  const isOwner = group.createdBy === currentUser.phone;

  useEffect(() => {
    // Fetch members detail
    const unsubMembers = onSnapshot(collection(db, 'users'), (snap) => {
      const list = snap.docs
        .map(d => d.data() as User)
        .filter(u => groupMembers.includes(u.phone));
      setMembers(list);
      setAllUsers(snap.docs.map(d => d.data() as User));
    });
    return () => unsubMembers();
  }, [groupMembers]);

  const handleUpdateName = async () => {
    if (!newName.trim() || newName === group.name) return setIsEditingName(false);
    try {
      await updateDoc(doc(db, 'groups', group.id), { name: newName });
      setIsEditingName(false);
    } catch (err) {
      alert("Failed to update name");
    }
  };

  const promoteToAdmin = async (phone: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'groups', group.id), { admins: arrayUnion(phone) });
      alert("User promoted to Admin!");
    } catch (err) {
      alert("Failed to promote user");
    }
  };

  const removeUserFromGroup = async (phone: string, name: string) => {
    if (!isAdmin) return;
    if (phone === group.createdBy) return alert("Owner cannot be removed");
    if (phone === currentUser.phone) return alert("You cannot remove yourself");

    if (window.confirm(`Are you sure you want to remove ${name} from this group?`)) {
      try {
        await updateDoc(doc(db, 'groups', group.id), { 
          members: arrayRemove(phone),
          admins: arrayRemove(phone) // Also remove from admin list if they were an admin
        });
        alert(`${name} has been removed`);
      } catch (err) {
        alert("Failed to remove user");
      }
    }
  };

  const addUserToGroup = async (phone: string) => {
    if (groupMembers.includes(phone)) return alert("Already in group");
    try {
      await updateDoc(doc(db, 'groups', group.id), { members: arrayUnion(phone) });
      alert("User added!");
    } catch (err) {
      alert("Failed to add user");
    }
  };

  const shareLink = () => {
    const text = `Join my group ${group.name} on ImoFlow! Link: imoflow.app/group/${group.id}`;
    navigator.clipboard.writeText(text).then(() => {
      alert("Group Link Copied to Clipboard!");
    }).catch(() => {
      alert("Failed to copy link");
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 overflow-y-auto no-scrollbar pb-20">
      {/* Header */}
      <div className="p-4 glass sticky top-0 z-[100] border-b dark:border-gray-800 flex items-center">
        <button onClick={onBack} className="p-2 -ml-2 text-gray-600 dark:text-gray-300">
           <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="ml-2 text-lg font-bold dark:text-white">Group Profile</h1>
      </div>

      {/* Group Info */}
      <div className="p-8 flex flex-col items-center bg-white dark:bg-gray-800 shadow-sm mb-6">
        <img src={group.logo} className="w-32 h-32 rounded-[40px] shadow-2xl border-4 border-white dark:border-gray-700 bg-gray-50 p-2 mb-6" alt="" />
        
        {isEditingName ? (
          <input 
            autoFocus 
            type="text" 
            value={newName} 
            onChange={e => setNewName(e.target.value)} 
            onBlur={handleUpdateName}
            onKeyDown={e => e.key === 'Enter' && handleUpdateName()}
            className="text-2xl font-black text-center bg-gray-100 dark:bg-gray-900 rounded-2xl p-2 dark:text-white outline-none ring-2 ring-blue-500" 
          />
        ) : (
          <div className="flex items-center space-x-2">
            <h2 className="text-3xl font-black text-gray-900 dark:text-white text-center">{group.name}</h2>
            {isAdmin && (
              <button onClick={() => setIsEditingName(true)} className="text-blue-500 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </button>
            )}
          </div>
        )}
        <p className="text-xs text-gray-500 mt-2 font-black uppercase tracking-widest">{group.type} Community</p>
      </div>

      {/* Actions */}
      <div className="px-6 grid grid-cols-2 gap-4 mb-8">
         <button onClick={shareLink} className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700 active:scale-95 transition-all">
            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-2"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg></div>
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Share Link</span>
         </button>
         <button onClick={() => setShowAddUser(true)} className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-[32px] shadow-sm border border-gray-100 dark:border-gray-700 active:scale-95 transition-all">
            <div className="w-12 h-12 bg-green-50 text-green-500 rounded-2xl flex items-center justify-center mb-2"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg></div>
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Add User</span>
         </button>
      </div>

      {/* Member List */}
      <div className="px-6 space-y-4">
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-2">Members — {members.length}</h3>
        <div className="bg-white dark:bg-gray-800 rounded-[32px] overflow-hidden border border-gray-100 dark:border-gray-700 shadow-sm">
          {members.map(member => (
            <div key={member.phone} className="p-4 flex items-center justify-between border-b last:border-0 dark:border-gray-700">
              <div className="flex items-center">
                <img src={member.profileImage} className="w-10 h-10 rounded-xl object-cover" alt="" />
                <div className="ml-3">
                  <div className="flex items-center">
                    <p className="text-sm font-bold dark:text-white leading-tight">{member.name}</p>
                    {member.phone === group.createdBy && <span className="ml-2 px-1.5 py-0.5 bg-yellow-50 text-yellow-600 text-[7px] font-black rounded uppercase border border-yellow-200">Owner</span>}
                    {groupAdmins.includes(member.phone) && member.phone !== group.createdBy && <span className="ml-2 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[7px] font-black rounded uppercase border border-blue-200">Admin</span>}
                  </div>
                  <p className="text-[9px] text-gray-500">{member.phone}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {isAdmin && !groupAdmins.includes(member.phone) && (
                  <button onClick={() => promoteToAdmin(member.phone)} className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-xl active:scale-90 transition-all">
                    Promote
                  </button>
                )}
                
                {/* Remove User Action - Visible to Admins for non-owners and not themselves */}
                {isAdmin && member.phone !== group.createdBy && member.phone !== currentUser.phone && (
                  <button 
                    onClick={() => removeUserFromGroup(member.phone, member.name)} 
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all active:scale-90"
                    title="Remove User"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6">
           <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setShowAddUser(false)} />
           <div className="relative bg-white dark:bg-gray-900 w-full max-w-sm rounded-[40px] p-8 shadow-2xl flex flex-col h-[80vh]">
              <h2 className="text-2xl font-black dark:text-white mb-4">Add Members</h2>
              <input 
                type="text" 
                placeholder="Search phone or name..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-gray-100 dark:bg-gray-800 p-4 rounded-2xl outline-none mb-6 text-sm dark:text-white"
              />
              <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
                {allUsers.filter(u => 
                  !groupMembers.includes(u.phone) && 
                  (u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.phone.includes(searchQuery))
                ).map(u => (
                  <div key={u.phone} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-2xl flex items-center justify-between border dark:border-gray-700">
                     <div className="flex items-center">
                        <img src={u.profileImage} className="w-10 h-10 rounded-xl" alt="" />
                        <div className="ml-3">
                           <p className="text-xs font-bold dark:text-white">{u.name}</p>
                           <p className="text-[9px] text-gray-500">{u.phone}</p>
                        </div>
                     </div>
                     <button onClick={() => addUserToGroup(u.phone)} className="p-2 bg-blue-600 text-white rounded-xl shadow-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4" /></svg></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowAddUser(false)} className="mt-6 w-full py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Done</button>
           </div>
        </div>
      )}
    </div>
  );
};
