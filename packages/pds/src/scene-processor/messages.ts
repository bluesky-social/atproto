export type AddMember = {
  type: 'add_member'
  scene: string
  member: string
}

export type RemoveMember = {
  type: 'remove_member'
  scene: string
  member: string
}

export type AddUpvote = {
  type: 'add_upvote'
  user: string
  subject: string
}

export type RemoveUpvote = {
  type: 'remove_upvote'
  user: string
  subject: string
}

export type Message = AddMember | RemoveMember | AddUpvote | RemoveUpvote
