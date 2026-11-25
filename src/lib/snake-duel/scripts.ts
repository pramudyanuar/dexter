// Keep room admission and WebRTC signaling atomic across Vercel instances.
export const CREATE_ROOM = `
local prior = redis.call('GET', KEYS[3])
if prior then return prior end
if not redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2]) then return '' end
redis.call('SET', KEYS[3], ARGV[3], 'EX', ARGV[2])
if ARGV[4] ~= '' then redis.call('ZADD', KEYS[2], ARGV[4], ARGV[3]) end
return ARGV[3]
`;

export const JOIN_ROOM = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'missing' end
local room = cjson.decode(raw)
local joining = cjson.decode(ARGV[1])
if room.paired then return 'full' end
if room.players[1].tokenHash == joining.tokenHash then return 'host' end
if type(room.players[2]) == 'table' and redis.call('EXISTS', KEYS[2]) == 1 then
  if room.players[2].tokenHash == joining.tokenHash then return 'guest' end
  return 'full'
end
room.players[2] = joining
redis.call('SET', KEYS[1], cjson.encode(room), 'KEEPTTL')
redis.call('SET', KEYS[2], '1', 'EX', ARGV[2])
redis.call('DEL', KEYS[3], KEYS[4])
return 'guest'
`;

export const EXCHANGE_SIGNAL = `
local raw = redis.call('GET', KEYS[1])
if not raw then return '' end
local room = cjson.decode(raw)
local player = tonumber(ARGV[1]) + 1
local seat = room.players[player]
if type(seat) ~= 'table' or seat.tokenHash ~= ARGV[2] then return 'forbidden' end
local guest = type(room.players[2]) == 'table'
  and (room.paired or redis.call('EXISTS', KEYS[5]) == 1) and room.players[2]
if player == 2 and not guest then return 'forbidden' end
if ARGV[3] ~= '' then
  local update = cjson.decode(ARGV[3])
  if not guest or (update.paired or update.guest) ~= guest.reservation then return 'stale' end
  if update.paired then
    if not room.paired then
      room.paired = true
      redis.call('SET', KEYS[1], cjson.encode(room), 'KEEPTTL')
      redis.call('ZREM', KEYS[6], room.code)
    end
  elseif not room.paired then
    redis.call('SET', KEYS[2], ARGV[3], 'EX', ARGV[5])
  end
end
if not room.paired then redis.call('SET', KEYS[4], '1', 'EX', ARGV[4]) end
local incoming = guest and redis.call('GET', KEYS[3])
return cjson.encode({
  names = {room.players[1].name, guest and guest.name or cjson.null},
  guest = guest and guest.reservation or cjson.null,
  signal = incoming and cjson.decode(incoming) or cjson.null
})
`;

export const QUEUE_OR_MATCH = `
local now = tonumber(ARGV[1])
local existing = redis.call('GET', KEYS[2])
if existing then return existing end
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
local ids = redis.call('ZRANGE', KEYS[1], 0, 0)
local peer = ids[1]
if peer then
  local peerKey = ARGV[6] .. peer
  local queued = redis.call('GET', peerKey)
  if queued then
    local member = cjson.decode(queued)
    if member.status == 'queued' and member.expiresAt > now then
      local proposal = cjson.decode(ARGV[5])
      proposal.room.players[1].name = member.name
      if not redis.call('SET', KEYS[3], cjson.encode(proposal.room), 'NX', 'EX', ARGV[7]) then
        return ''
      end
      redis.call('SET', KEYS[4], '1', 'EX', ARGV[8])
      local first = cjson.encode({status = 'matched', session = proposal.sessions[1]})
      local second = cjson.encode({status = 'matched', session = proposal.sessions[2]})
      redis.call('ZREM', KEYS[1], peer)
      redis.call('SET', peerKey, first, 'EX', 90)
      redis.call('SET', KEYS[2], second, 'EX', 90)
      return second
    end
  end
  redis.call('ZREM', KEYS[1], peer)
end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[3])
redis.call('SET', KEYS[2], ARGV[4], 'PX', tonumber(ARGV[2]) - now)
return ARGV[4]
`;

export const CANCEL_TICKET = `
local raw = redis.call('GET', KEYS[2])
if raw and cjson.decode(raw).status == 'matched' then return raw end
redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('DEL', KEYS[2])
return ''
`;

export const LIMIT_ADMISSION = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], 60) end
return count
`;
