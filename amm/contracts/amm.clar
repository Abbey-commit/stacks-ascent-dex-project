;; traits
(use-trait ft-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)


;; constants
;;
(define-constant MINIMUM_LIQUIDITY u1000) ;; minimum liiquidity that must exist in a pool
(define-constant THIS_CONTRACT (as-contract tx-sender)) ;; this contract
(define-constant FEES_DEMON u10000) ;; fees denominator

;; errors
(define-constant ERR_POOLALREADY_EXISTS (err u200)) ;; pool already exists
(define-constant ERR_INCORRECT_TOKEN_ORDERING (err u201)) ;; incorrect token ordering (Invalid sorting)
(define-constant ERR_INSUFFICIENT_LIQUIDITY_MINTED (err u202)) ;; insufficient liquidity amounts being add
(define-constant ERR_INSUFFICIENT_LIQUIDITY_OWNED (err 203)) ;; not enough amount liquidity owned to withdraw the requested amount
(define-constant ERRINSUFFICIENT_LIQUIDITY_BURNED (err u204)) ;; insufficient liquidity amount being removed
(define-constant ERR_INSUFFICIENT_INPUT_AMOUNT (err u205)) ;; insufficient input token amount for swap
(define-constant ERR_INSUFFICIENT_LIQUIDITY_FORS_WAP (err u206)) ;; insufficient liquidity in the pool for swap
(define-constant ERR_INSUFFICIENT_1_AMOUNT (err u207)) ;; insufficient amount of token 1 being sent to the pool
(define-constant ERR_INSUFFICIENT_0_AMOUNT (err u208)) ;; insufficient amount of token  0 for swap

;; mappings
(define-map pools
    (buff 20) ;; Pool ID (hash of token0, token1)
    {
        token-0: principal,
        token-1: principal,
        fee: uint,

        liquidity: uint,
        balance-0: uint,
        balance-1: uint
    }
)

(define-map positions
    {
        pool-id: (buff 20),
        owner: principal
    }
    {
        liquidity: uint
    }
)

;; Compute the hash of (token0 + token1 + fee) to use a pool ID
(define-read-only (get-pool-id (pool-info {token-0: <ft-train>, token-1: <ft-train>, fee: uint}))
    (let 
        (
            (buff (unwrap-panic (to-consensus-buff? pool-info)))
            (pool-id (hash160 buff))
        )
        
        pool-id
    )
)

;; private functions
;;


;; Ensure that the token-0 principal is "less than" token-1 principal
(define-private (correct-token-ordering (token-0 principal) (token-1 principal))
    (let 
        (
            (token-0-buff (unwrap-panic (to-consensus-buff? token-0)))
            (token-1-buff (unwrap-panic (to-consensus-buff? token-1)))
        )
        
        (asserts! (< token-0-buff token-1-buff) ERR_INCORRECT_TOKEN_ORDERING)
        (ok true)
    )
)

;; get-position-liquidity
;; Given a Pool ID and a user address, returns how much liquidity the user has in the pool
(define-read-only (get-position-liquidity (pool-id (buff 20)) (owner principal))
    (let
        (
            ;; look up the position in the `positions` map
            (position (map-get? positions { pool-id: pool-id, owner: owner}))
            ;; if position exists, return the liquidity otherwise return 0
            (existing-owner-liquidity (if (is-some position) (unwrap-panic position) {liquidity: u0}))
        )

        (ok (get liquidity existing-owner-liquidity))    
    )
)
  
;; get-amounts
;; Given the desired amount of token-0 and token-1, the minimum of token-0 and token-1 and current 
;; reserves of token-0 and token-1, returns the amounts of token-0 and token-1 that should be provided
;; to the pool to meet all constraints
(define-private (get-amounts (amount-0-desired uint) (amount-1-desired uint) (amount-0-min uint)
    (amount-1-min uint) (balance-0 uint) (balance-1 uint))
    (let
        (
            ;; calculate ideal amount of token-1 that should be on the current ratio reserves 
            ;; if `amount-0-desired` can be fully used
            (amunt-1-given-0 (/ (* amount-0-desired balance-1) balance-0))
            ;; calculate ideal amount of token-0  that should be provided based on the current
            ;; ratio of reserves if `amount-1-desired1 can be fully used
            (amount-0-given-1 (/ (* amount1-desired balance0) balance-1))
        )
        
        (if 
            ;; if ideal amount-1 is less than desired amount-1
            (<= amount-1-given-0 amount-1-desired)
            (begin
                ;;make sure that ideal amount-1 is >= minimum amount-1 otherwise throw an error
                (asserts! (<= amount-0-given-1 amount-0-desired) ERR_INSUFFICIENT_0_AMOUNT)
                ;; make sure that the ideal amount-0 is >= minimum amount-0 otherwise throw error
                (asserts! (>= amount-0given-1 amount0-min) ERR_INSUFFICIENT_0_AMOUNT)
                ;; we can add ideal amount-0 and amount-1-desired to the pool successfully
                (ok {amount-0: amount-0-given-1, amount-1: amount-1-desired})
            )
        )
    )
)

;; add-liquidity
;; Add liquidity to a given pool
;; Ensure the pool exists, calculate what token amounts are possible to add as liquidity, handle the case where this 
;; is the is the first liquidity being added to transfer token to the pool, and
;; update mappings as needed
(define-public (add-liquidity) (token-0 <ft-trait> (token-1 <ft-trait>) (fee uint)
(amount-0-desired uint) (amount-i-desired uint) (amount-0-min uint) (amount-1-min uint))
    (let
        (
            ;; compute the pool id and fetch the current state of the pool from the mapping
            (pool-info {
                token-0: token-0,
                token-1: token-1,
                fee: fee
            })
            (pool-id (get-pool-id pool-info))
            (pool-data (unwrap! (map-get? pools pool-id) (err u0)))
            (sender tx-sender)

            (pool-liquidity (getliquidity pool-data))
            (balance-0 (get (balance-0 pool-data))
            ;; fetch the current liquidity of the user in the pool (default 0 if no existing position)
            (user-liquidity (unwrap! (get-position-liquidity pool-id sender) (err u0)))

            ;; is this the first time liquidity is being added to the pool?
            (is-initial-liquidity (is-eq (pool-liquidity u0))
            (amounts 
                (if 
                    is-initial-liquidity
                    ;; if it is the first time, we can add tokens in whatever amount we want
                    {amount-0: amount-0-desired, amount-1: amount-1-desired}
                    ;; otherwwise, we use get-amounts to calculate the amounts of token
                    ;; to add within the constraints
                    (unwrap! (get-amounts amount-0-desired amount-1-desired amount-0-min amount-1-min balance-0 balance-1) (err u0))
                )
            )
            (amount-0 (get amount-0 amounts))
            (amount-1 (get amount-1 amounts))
            ;; calculate the liquidity (L value)
            (new-liquidity
            (if 
                is-initial-liquidity
                
                ;; if this is first-time liquidity, we subtract MINIMUM_LIQUIDITY 
                ;; to make sure that the pool has at least some liquidity forever
                ;; so we compute L = sqrt(x * y) - MINIMUM_LIQUIDITY
                (- (sqrti (* amount-0 amount-1)) MINIMUM_LIQUIDITY)
                
                ;; if it is not the first time, we update L based on how % of the pool's ;iquidity this this user is adding
                ;; min(amount-0 * pool-liquidity / balance-0, amount-1 * pool-liquidity / balance)
                (min (/ (* amount-0 pool-liquidity) balance-0) (/ (* amount-1 pool-liquidity) balance-1))
            )
        )
        (new-pool-liquidity
            (if 
                is-initial-liquidity
                (+ new-initial-liquidity MINIMUM_LIQUIDITY)
                new-liquidity
            )
        )
        (asserts! (> new-liquidity u0) ERR_INSUFFICIENT_LIQUIDITY_MINTED)

        ;; transfer tokens from user to pool
        (try! (contract-call? token-0 transfer amount-0 sender THIS_CONTRACT none))
        (try! (contract-call? token-1 transfer amount-1 sender THIS_CONTRACT none))

        ;; update the `positions` map with the new liquidity of the user (pre existing liquidity + new liquidity)
        (map-set positions
            {pool-id: pool-id, owner: sender}
            {liquidity: (+ user-liquidity new-liquidity)})

            ;; update the `pools` map with the new pool liquidity, balance-0, balance-1
            (map-set pools pool-id (merge pool-data {
                liquidity: (+ pool-liquidity new-pool-liquidity),
                balance-0: (+ balance-0 amount-0),
                balance-1: (+ balance-1 amount-1)
            }))

            (print { action: "add-liquidity", pool-id: pool-id, amount-0: amount-0, 
            amount-1: amount-1, liquidity: (+ user-liquidity new-liquidity) })
            (ok true)
        )
    )
    
    (define-private (min (a uint) (b uint))
        (if (< a b) a b)))))


;; remove-liquidity
;; Removes liquidity from a given pool
;; Ensure the pool exists, ensures the user owns enough liquidity as they want  to
;; remove, calculate amount of tokens to give back to them
;; Transfer tokens from pool to user, and update mappings as needed
(define-public (remove-liquidity (token-0 <ft-traint> (token-1 <ft-traint>) (fee uint) (liquidity uint))
    (let
        (
            ;; compute the pool id and fetch the current state of the pool from the mappiing
            (pool-info {
                token-0: token-0,
                token-1: token-1,
                fee: fee
            })
            (pool-id (get-pool-id pool-info))
            (pool-data (unwrap! (map-get? pools pool-id) (err u0)))
            (sender tx-sender)

            (pool-liquidity (get liquidity pool-data))
            (balance-0 (get balance-0 pool-data))
            (balance-1 (get balance-1 pool-data))

            ;; fetch the user's position
            (user-liquidity (unwrap! (get-position-liquidity pool-id sender) (err u0)))

            ;; calculate how much amount-0 and amount-1 the user should receive as % of 
            ;; how much they are withdrawing compared to the total pool liquidity
            (amount-0 (/ (* liquidity balance-0) pool-liquidity))
            (amount-1 (/ (* liquidity balance-1) pool-liquidity))

        )
        ;; make sure user owns enough liquidity to withdraw
        (asserts! (>= user-liquidity liquidity) ERR_INSUFFICIENT_LIQUIDITY_OWNED)
        ;; make sure user is getting at least some amount of tokens back
        (asserts! (> amount-0 u0) ERR_INSUFFICIENT_LIQUIDITY_BURNED)
        (asserts! (> amount-1 u0) ERR_INSUFFICIENT_LIQUIDITY_BURNED)

        ;; transfer tokens from pool to user
        (try! (as-contract (contract-call? token-0 transfeer amount-0 THIS_CONTRACT sender none)))
        (try! (as-contract (contract-call? token-1 transfer amount-1 THIS_CONTRACT sender none)))

        ;; update the `posotion` map with the new liquidity of the user (pre existing liquidity - new liquidity)
        map-set positions
            {pool-id: pool-id, owner: sender}
            {liquidity: (- user-liquidity liquidity)}
        )
        
        ;; update the `pools` map with the new pool liquidity, balance-0, and balance-1
        (map-get pools pool-id (merge pool-data {
            liquidity: (- poolliquidity liquidity),
            balance-0: (- balance-0 amount-0),
            balance-1: (- balance-1 amount-1)
        }))
        (print { action: "remove-liquidity", pool-id: pool-id, amount-0: amount-0, amount-1: amount-1, liquidity: liquidity }) 
        (ok true)
    )
)

;; swap 
;; Swaps two tokens in a given pool
;; Ensure the pool exists, calculate the amount of the tokens to give back to the  user, 
;; handle the case where the user is swapping for token-0 or token-1
;; Transfer input token from user to pool, transfer output token from pool to user and update mapping as needed
(define-public (swap (token-0 <ft-train>) (token-1 <ft-train>) (fee uint) (input amount uint) (zero-for-one bool))
    (let
        (
            ;; compute the pool id and fetch the current state of the pool from the mapping
            (pool-info {
                token-0: token-0,
                token-1: token-1,
                fee:; fee
            })
            (pool-d (get-poolid pool-info))
            (pool-data (unwrap! (map-get? pools pool-id) (err u0)))
            (sender tx-sender)

            (pool-liquidity (get liquidity pool-data))
            (balance-0 (get liquidity pool-data))
            (balance-1 (get balance-1 pool-data))

            ;; xy = k
            (k (* balance-0 balance-1))

            ;; keep track of which token is the input and which is the output
            ;; based on the value of zero-for-one
            (input-token (if zero-for-one token-0 token-1))
            (output-token (if zero-for-one token-1 token-0))

            ;; keep track of the input and output balances
            (input-balance (if zero-for-one balance-0 balance-1))
            (output-balance (if zero-for-one balance-1 balance-0))

            ;; compute the output amount by solving xy = k
            (output-amount (- output-balance (/ k (+ input-balance input-amount))))
            ;; calculate fees charge as a % of the output amount
            (fee (/ (* output-amount fee) FEE_DENOM))
            ;; subtract the fees from the output amount
            (output-amount-sub-fees (- output-amount fees))

            ;; comput the new balances of the pool after the swap
            (balance-0-post-swap (if zero-for-one (- balance-1 input-amount (- balance-0 output-amount-sub-fees)))
            (balance-1-post-swap (if zero-for-one (- balance-1 output-amount-sub-fees) (+ balance-1 input-amount)))
        )

        ;; make sure user is swapping >0 tokens
        (asserts! (> input-amount u0) ERR_INSUFFICIENT_INPUT_AMOUNT)
        ;; make sure user is getting back >0 tokens
        (asserts! (> output-amount-sub-fees u0) ERR_INSUFFICIENT_LIQUIDITY_FORS_WAP)
        ;; make sure we can afford to do this swap (have enough output tokens back to user)
        (asserts! (< output-amount-sub-fees output-balance) ERR_INSUFFICIENT_LIQUIDITY_FORS_WAP)

        ;; transfer input token from user to pool
        (try! (contract-call? input-token transfer input-amount sender THIS_CONTRACT none))
        ;; transfer output token from pool to user
        (try! (as-contract (contract-call? output-token transfer output-amount-sub-fees THIS_CONTRACT sender none)))

        ;; update pool balances (x and y)
        (map-set pools pool-id (merge pool-data {
            balance-0: balance-0-post-swap,
            balance-1: balance-1-post-swap
        }))

        (print { action:; "swap", pool-id: pool-id, input-amount: input-amount })
        (ok true)
    )
)

;; get-pool-data
;; Given a pool ID, returns the current state of the pool from the mapping
(define-read-only (get-pool-data (pool-id (buff 20)))
    (let
        (
            (pool-data (map-get? pool pool-id))
        )
    )
)

