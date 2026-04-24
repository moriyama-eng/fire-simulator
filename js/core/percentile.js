// ====================================================================
// js/core/percentile.js
// ====================================================================

export function multiSelectTrue(workBuffer, ks, out) {
    const stack = [0, workBuffer.length - 1, 0, ks.length - 1];
    while (stack.length > 0) {
        const kRightIdx = stack.pop();
        const kLeftIdx = stack.pop();
        const right = stack.pop();
        const left = stack.pop();
        if (left > right || kLeftIdx > kRightIdx) continue;
        const pivotIdx = (left + right) >> 1;
        const pivot = workBuffer[pivotIdx];
        let i = left, j = right;
        while (i <= j) {
            while (workBuffer[i] < pivot) i++;
            while (workBuffer[j] > pivot) j--;
            if (i <= j) {
                const tmp = workBuffer[i]; workBuffer[i] = workBuffer[j]; workBuffer[j] = tmp;
                i++; j--;
            }
        }
        let midLeftKIdx = kLeftIdx;
        while (midLeftKIdx <= kRightIdx && ks[midLeftKIdx] <= j) midLeftKIdx++;
        let midRightKIdx = kRightIdx;
        while (midRightKIdx >= kLeftIdx && ks[midRightKIdx] >= i) midRightKIdx--;
        if (kLeftIdx < midLeftKIdx) stack.push(left, j, kLeftIdx, midLeftKIdx - 1);
        if (midRightKIdx < kRightIdx) stack.push(i, right, midRightKIdx + 1, kRightIdx);
        for (let k = midLeftKIdx; k <= midRightKIdx; k++) out[k] = workBuffer[ks[k]];
    }
}

export function quickselectSafe(arr, k, left, right) {
    while (left < right) {
        const pivot = arr[(left + right) >> 1];
        let i = left, j = right;
        while (i <= j) {
            while (arr[i] < pivot) i++;
            while (arr[j] > pivot) j--;
            if (i <= j) {
                const tmp = arr[i]; arr[i++] = arr[j]; arr[j--] = tmp;
            }
        }
        if (k <= j) right = j;
        else if (k >= i) left = i;
        else return arr[k];
    }
    return arr[k];
}