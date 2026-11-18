// Keep admission, capacity, and frame updates atomic across Vercel instances.
export const CREATE_ROOM = `
local prior = redis.call('GET', KEYS[3])
if prior then return prior end
if not redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2]) then return '' end
redis.call('SET', KEYS[3], ARGV[3], 'EX', ARGV[2])
if ARGV[4] ~= '' then redis.call('ZADD', KEYS[2], ARGV[4], ARGV[3]) end
return ARGV[3]
`;

export const COMMIT_ROOM = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
local change = cjson.decode(ARGV[4])
if change.owner and redis.call('GET', KEYS[3]) ~= change.owner then return -1 end
if change.reserve then
  redis.call('ZREMRANGEBYSCORE', KEYS[4], '-inf', change.now)
  if redis.call('ZCARD', KEYS[4]) >= 2 then return -2 end
  local used = tonumber(redis.call('GET', KEYS[6]) or '0')
  if used >= change.monthlyRounds then return -3 end
  redis.call('ZADD', KEYS[4], change.deadline, change.reserve)
  if redis.call('INCR', KEYS[6]) == 1 then redis.call('EXPIRE', KEYS[6], 3024000) end
end
if change.release then redis.call('ZREM', KEYS[4], change.release) end
if change.owner then redis.call('PEXPIRE', KEYS[3], change.leaseMs) end
if change.lobby == 'open' then
  redis.call('ZADD', KEYS[5], change.indexExpiry, change.code)
elseif change.lobby == 'hide' then
  redis.call('ZREM', KEYS[5], change.code)
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', change.roomTtl)
redis.call('PUBLISH', KEYS[2], ARGV[3])
return 1
`;

export const ATTACH = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local room = cjson.decode(raw)
local seat = room.players[tonumber(ARGV[1]) + 1]
if type(seat) ~= 'table' or seat.tokenHash ~= ARGV[2] then return 0 end
local now = tonumber(ARGV[4])
local presence = {id = ARGV[3], seenAt = now}
local prior = redis.call('GET', KEYS[2])
if prior and type(room.round) == 'table' and room.round.phase ~= 'over' then
  local previous = cjson.decode(prior)
  local lostAt = previous.closedAt or (previous.seenAt + tonumber(ARGV[6]))
  if previous.expiredRound == room.round.id or now - lostAt >= tonumber(ARGV[7]) then
    presence.expiredRound = room.round.id
  end
end
redis.call('SET', KEYS[2], cjson.encode(presence), 'EX', ARGV[5])
return 1
`;

export const UPDATE_PRESENCE = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local presence = cjson.decode(raw)
if presence.id ~= ARGV[1] or presence.closedAt then return 0 end
if ARGV[4] == 'close' then
  presence.closedAt = tonumber(ARGV[2])
else
  presence.seenAt = tonumber(ARGV[2])
end
redis.call('SET', KEYS[1], cjson.encode(presence), 'EX', ARGV[3])
return 1
`;

export const UPDATE_INPUT = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local presence = cjson.decode(raw)
if presence.id ~= ARGV[1] or presence.closedAt then return 0 end
local previous = redis.call('GET', KEYS[2])
if previous then
  local input = cjson.decode(previous)
  if input.player == ARGV[1] and input.roundId == ARGV[3] and input.seq >= tonumber(ARGV[4]) then
    return 0
  end
end
redis.call('SET', KEYS[2], ARGV[2], 'PX', 3000)
return 1
`;

export const UPDATE_LEASE = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
if ARGV[2] == '0' then return redis.call('DEL', KEYS[1]) end
return redis.call('PEXPIRE', KEYS[1], ARGV[2])
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
